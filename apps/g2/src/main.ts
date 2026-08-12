import './style.css'
import {
  CreateStartUpPageContainer,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { loadThread, loadTimeline } from './api.js'
import { registerBackgroundState } from './background-state.js'
import { classifyInput, type InputAction } from './input.js'
import { renderGlassesText } from './presentation.js'
import {
  initialReaderState,
  readerSnapshot,
  reduceReaderState,
  restoreReaderSnapshot,
  type ReaderState,
} from './reader-state.js'

const CONTAINER_ID = 1
const CONTAINER_NAME = 'x_reader'
let state: ReaderState = initialReaderState()
let updateGlasses: (() => Promise<void>) | undefined
let stateRevision = 0

function element(id: string): HTMLElement | null {
  return document.getElementById(id)
}

function updatePhone(): void {
  const post = state.posts[state.index]
  const connection = element('connection')
  if (connection) {
    connection.textContent =
      state.status === 'ready'
        ? 'Gateway connected'
        : state.status === 'error'
          ? state.error
          : 'Loading timeline…'
    connection.dataset.state = state.status
  }
  if (element('feed'))
    element('feed')!.textContent = state.mode === 'thread' ? 'THREAD' : state.feed.toUpperCase()
  if (element('author'))
    element('author')!.textContent = post
      ? `${post.authorName} · @${post.authorHandle}`
      : 'No post selected'
  if (element('post')) element('post')!.textContent = post?.text ?? 'Waiting for timeline'
  if (element('position'))
    element('position')!.textContent = post
      ? `${state.index + 1} / ${state.posts.length} · ${post.likeCount} likes`
      : '—'
}

async function render(): Promise<void> {
  updatePhone()
  await updateGlasses?.()
}

async function loadCurrentFeed(): Promise<void> {
  const revision = stateRevision
  const feed = state.feed
  state = reduceReaderState(state, { type: 'timeline-loading' })
  await render()
  try {
    const page = await loadTimeline(feed)
    if (revision !== stateRevision || feed !== state.feed) return
    state = reduceReaderState(state, {
      type: 'timeline-loaded',
      posts: page.posts,
      nextCursor: page.nextCursor,
    })
  } catch (error) {
    if (revision !== stateRevision || feed !== state.feed) return
    state = reduceReaderState(state, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  await render()
}

async function handleAction(action: InputAction): Promise<void> {
  if (!action || action === 'cleanup' || action === 'exit') return
  if (action === 'cycle-feed') {
    state = reduceReaderState(state, { type: 'cycle-feed' })
    await loadCurrentFeed()
    return
  }
  if (action === 'toggle-detail') {
    if (state.status === 'error') {
      await loadCurrentFeed()
      return
    }
    if (state.mode === 'thread') {
      state = reduceReaderState(state, { type: 'close-thread' })
      await render()
      return
    }
    const current = state.posts[state.index]
    if (!current) return
    state = reduceReaderState(state, { type: 'timeline-loading' })
    await render()
    try {
      const thread = await loadThread(current.id)
      state = reduceReaderState(state, { type: 'thread-loaded', posts: thread.posts })
    } catch (error) {
      state = reduceReaderState(state, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    await render()
    return
  }
  if (
    action === 'next' &&
    state.index === state.posts.length - 1 &&
    state.nextCursor &&
    state.mode === 'timeline'
  ) {
    try {
      const page = await loadTimeline(state.feed, state.nextCursor)
      state = reduceReaderState(state, {
        type: 'timeline-appended',
        posts: page.posts,
        nextCursor: page.nextCursor,
      })
    } catch (error) {
      state = reduceReaderState(state, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
  state = reduceReaderState(state, { type: action })
  await render()
}

registerBackgroundState(
  'readerState',
  () => readerSnapshot(state),
  (saved) => {
    stateRevision += 1
    state = restoreReaderSnapshot(state, saved)
    void render()
  },
)

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
  button.addEventListener('click', () => void handleAction(button.dataset.action as InputAction))
}
updatePhone()

async function startGlasses(): Promise<void> {
  const bridge = await waitForEvenAppBridge()
  let renderedLength = 0
  const container = (content: string) =>
    new TextContainerProperty({
      xPosition: 0,
      yPosition: 0,
      width: 576,
      height: 288,
      borderWidth: 0,
      borderColor: 0,
      borderRadius: 0,
      paddingLength: 12,
      containerID: CONTAINER_ID,
      containerName: CONTAINER_NAME,
      isEventCapture: 1,
      content,
    })
  const initial = renderGlassesText(state)
  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 1,
      textObject: [container(initial)],
    }),
  )
  if (result !== StartUpPageCreateResult.success)
    throw new Error(`Unable to create G2 page: ${result}`)
  renderedLength = initial.length
  updateGlasses = async () => {
    const content = renderGlassesText(state)
    const upgraded = await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: CONTAINER_ID,
        containerName: CONTAINER_NAME,
        contentOffset: 0,
        contentLength: renderedLength,
        content,
      }),
    )
    if (!upgraded) {
      await bridge.rebuildPageContainer(
        new RebuildPageContainer({
          containerTotalNum: 1,
          textObject: [container(content)],
        }),
      )
    }
    renderedLength = content.length
  }

  let queue = Promise.resolve()
  const unsubscribe = bridge.onEvenHubEvent((event: EvenHubEvent) => {
    queue = queue
      .then(async () => {
        const action = classifyInput(event)
        if (action === 'exit') {
          await bridge.shutDownPageContainer(1)
        } else if (action === 'cleanup') {
          unsubscribe()
        } else {
          await handleAction(action)
        }
      })
      .catch((error: unknown) => console.error(error))
  })
  if (state.posts.length === 0) await loadCurrentFeed()
  else await render()
}

void startGlasses().catch((error: unknown) => {
  console.warn('Even Hub bridge is not available in this browser', error)
  void loadCurrentFeed()
})

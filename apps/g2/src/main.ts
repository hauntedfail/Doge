import './style.css'
import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { loadAvatarImage, loadPostImage, loadThread, loadTimeline } from './api.js'
import { browserAccessToken, clearBrowserAccessToken, saveBrowserAccessToken } from './auth.js'
import { registerBackgroundState } from './background-state.js'
import { classifyInput, type InputAction } from './input.js'
import {
  METRIC_ICON_SIZE,
  METRIC_STRIP_WIDTH,
  renderMetricIconStrip,
  type MetricIconKind,
} from './metric-icons.js'
import {
  POST_IMAGE_HEIGHT,
  POST_IMAGE_WIDTH,
  renderPostImage,
  renderPostImagePlaceholder,
} from './post-image.js'
import { renderGlassesSections } from './presentation.js'
import {
  initialReaderState,
  readerSnapshot,
  reduceReaderState,
  restoreReaderSnapshot,
  type ReaderState,
} from './reader-state.js'

const HEADER_ID = 1
const AUTHOR_ID = 2
const BODY_ID = 3
const AVATAR_ID = 4
const REPLY_COUNT_ID = 5
const REPOST_COUNT_ID = 6
const LIKE_COUNT_ID = 7
const HELP_ID = 8
const METRIC_STRIP_ID = 9
const POST_IMAGE_ID = 10
const HEADER_NAME = 'doge_header'
const AUTHOR_NAME = 'doge_author'
const BODY_NAME = 'doge_body'
const AVATAR_NAME = 'doge_avatar'
const REPLY_COUNT_NAME = 'doge_reply_num'
const REPOST_COUNT_NAME = 'doge_rp_num'
const LIKE_COUNT_NAME = 'doge_like_num'
const HELP_NAME = 'doge_help'
const METRIC_STRIP_NAME = 'doge_metrics'
const POST_IMAGE_NAME = 'doge_post_img'
const AVATAR_SIZE = 48
const PLAIN_METRIC_Y = 220
const MEDIA_METRIC_Y = 258
const METRIC_COUNT_HEIGHT = 30
const POST_IMAGE_X = 144
const POST_IMAGE_Y = 156

interface MetricLayout {
  kind: MetricIconKind
  countID: number
  countName: string
  countX: number
  countWidth: number
}

const METRIC_LAYOUT: readonly MetricLayout[] = [
  {
    kind: 'reply',
    countID: REPLY_COUNT_ID,
    countName: REPLY_COUNT_NAME,
    countX: 174,
    countWidth: 62,
  },
  {
    kind: 'repost',
    countID: REPOST_COUNT_ID,
    countName: REPOST_COUNT_NAME,
    countX: 270,
    countWidth: 62,
  },
  {
    kind: 'like',
    countID: LIKE_COUNT_ID,
    countName: LIKE_COUNT_NAME,
    countX: 366,
    countWidth: 62,
  },
]
let state: ReaderState = initialReaderState()
let bodyPage = 0
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
  element('pairing')?.toggleAttribute('hidden', Boolean(browserAccessToken()))
  element('forget-device')?.toggleAttribute('hidden', !browserAccessToken())
}

async function render(): Promise<void> {
  updatePhone()
  await updateGlasses?.()
}

async function loadCurrentFeed(): Promise<void> {
  const revision = stateRevision
  const feed = state.feed
  bodyPage = 0
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
    bodyPage = 0
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
      bodyPage = 0
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
      bodyPage = 0
    } catch (error) {
      state = reduceReaderState(state, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    await render()
    return
  }
  const currentSections = renderGlassesSections(state, bodyPage)
  if (action === 'next' && bodyPage < currentSections.bodyPageCount - 1) {
    bodyPage += 1
    await render()
    return
  }
  if (action === 'previous' && bodyPage > 0) {
    bodyPage -= 1
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
  const previousIndex = state.index
  state = reduceReaderState(state, { type: action })
  if (state.index !== previousIndex) {
    bodyPage = action === 'previous' ? renderGlassesSections(state).bodyPageCount - 1 : 0
  }
  await render()
}

registerBackgroundState(
  'readerState',
  () => readerSnapshot(state),
  (saved) => {
    stateRevision += 1
    state = restoreReaderSnapshot(state, saved)
    bodyPage = 0
    void render()
  },
)

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
  button.addEventListener('click', () => void handleAction(button.dataset.action as InputAction))
}
element('pairing')?.addEventListener('submit', (event) => {
  event.preventDefault()
  const input = element('access-key')
  const message = element('pairing-message')
  if (!(input instanceof HTMLInputElement)) return
  if (!saveBrowserAccessToken(input.value)) {
    if (message) message.textContent = 'Enter the 43-character Doge access key.'
    return
  }
  input.value = ''
  if (message) message.textContent = 'This iPhone is paired with Doge.'
  stateRevision += 1
  state = initialReaderState()
  bodyPage = 0
  void loadCurrentFeed()
})
element('forget-device')?.addEventListener('click', () => {
  clearBrowserAccessToken()
  stateRevision += 1
  state = { ...initialReaderState(), status: 'error', error: 'Access key required on this iPhone' }
  bodyPage = 0
  void render()
})
updatePhone()

async function startGlasses(): Promise<void> {
  const bridge = await waitForEvenAppBridge()
  const renderedLengths = new Map<number, number>()
  const avatarCache = new Map<string, Promise<ArrayBuffer>>()
  const postImageCache = new Map<string, Promise<string>>()
  let renderedAvatarUrl: string | null | undefined
  let renderedPostImageUrl: string | null | undefined
  let renderedHasPostImage = false
  let bridgeQueue = Promise.resolve()

  const textContainer = (
    containerID: number,
    containerName: string,
    xPosition: number,
    yPosition: number,
    width: number,
    height: number,
    zOrderIndex: number,
    content: string,
    isEventCapture = 0,
  ) =>
    new TextContainerProperty({
      xPosition,
      yPosition,
      width,
      height,
      borderWidth: 0,
      borderColor: 0,
      borderRadius: 0,
      paddingLength: 0,
      containerID,
      containerName,
      isEventCapture,
      zOrderIndex,
      content,
    })

  const avatarContainer = () =>
    new ImageContainerProperty({
      xPosition: 12,
      yPosition: 38,
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      containerID: AVATAR_ID,
      containerName: AVATAR_NAME,
      zOrderIndex: 4,
    })

  const metricStripContainer = (yPosition: number) =>
    new ImageContainerProperty({
      xPosition: POST_IMAGE_X,
      yPosition,
      width: METRIC_STRIP_WIDTH,
      height: METRIC_ICON_SIZE,
      containerID: METRIC_STRIP_ID,
      containerName: METRIC_STRIP_NAME,
      zOrderIndex: 6,
    })

  const postImageContainer = () =>
    new ImageContainerProperty({
      xPosition: POST_IMAGE_X,
      yPosition: POST_IMAGE_Y,
      width: POST_IMAGE_WIDTH,
      height: POST_IMAGE_HEIGHT,
      containerID: POST_IMAGE_ID,
      containerName: POST_IMAGE_NAME,
      zOrderIndex: 5,
    })

  const page = (sections: ReturnType<typeof renderGlassesSections>) => {
    const hasPostImage = sections.postImageUrl !== null
    const metricY = hasPostImage ? MEDIA_METRIC_Y : PLAIN_METRIC_Y
    const textObject = [
      textContainer(HEADER_ID, HEADER_NAME, 8, 4, 560, 28, 1, sections.header),
      textContainer(AUTHOR_ID, AUTHOR_NAME, 72, 36, 492, 58, 2, sections.author),
      textContainer(BODY_ID, BODY_NAME, 8, 100, 560, hasPostImage ? 52 : 112, 3, sections.body, 1),
      ...METRIC_LAYOUT.map((metric, index) =>
        textContainer(
          metric.countID,
          metric.countName,
          metric.countX,
          metricY - 4,
          metric.countWidth,
          METRIC_COUNT_HEIGHT,
          7 + index,
          sections.metricCounts[metric.kind],
        ),
      ),
    ]
    if (!hasPostImage) {
      textObject.push(textContainer(HELP_ID, HELP_NAME, 8, 252, 560, 36, 10, sections.help))
    }
    return {
      textObject,
      imageObject: [
        avatarContainer(),
        ...(hasPostImage ? [postImageContainer()] : []),
        metricStripContainer(metricY),
      ],
      hasPostImage,
    }
  }

  const fallbackAvatar = (): string => {
    const canvas = document.createElement('canvas')
    canvas.width = AVATAR_SIZE
    canvas.height = AVATAR_SIZE
    const context = canvas.getContext('2d')
    if (context) {
      context.clearRect(0, 0, AVATAR_SIZE, AVATAR_SIZE)
      context.strokeStyle = '#fff'
      context.lineWidth = 3
      context.beginPath()
      context.arc(24, 24, 21, 0, Math.PI * 2)
      context.stroke()
      context.beginPath()
      context.arc(24, 18, 7, 0, Math.PI * 2)
      context.stroke()
      context.beginPath()
      context.arc(24, 42, 14, Math.PI, 0)
      context.stroke()
    }
    return canvas.toDataURL('image/png').split(',', 2)[1] ?? ''
  }

  const avatarData = async (url: string | null): Promise<ArrayBuffer | string> => {
    if (!url) return fallbackAvatar()
    let pending = avatarCache.get(url)
    if (!pending) {
      pending = loadAvatarImage(url)
      avatarCache.set(url, pending)
      if (avatarCache.size > 64) avatarCache.delete(avatarCache.keys().next().value ?? '')
    }
    try {
      return await pending
    } catch (error) {
      avatarCache.delete(url)
      console.warn('Unable to load avatar', error)
      return fallbackAvatar()
    }
  }

  const updateAvatar = async (url: string | null, force = false): Promise<void> => {
    if (!force && renderedAvatarUrl === url) return
    const result = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: AVATAR_ID,
        containerName: AVATAR_NAME,
        imageData: await avatarData(url),
      }),
    )
    if (result !== ImageRawDataUpdateResult.success) {
      console.warn(`Avatar update failed: ${result}`)
      return
    }
    renderedAvatarUrl = url
  }

  const updateMetricStrip = async (): Promise<void> => {
    const result = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: METRIC_STRIP_ID,
        containerName: METRIC_STRIP_NAME,
        imageData: renderMetricIconStrip(),
      }),
    )
    if (result !== ImageRawDataUpdateResult.success) {
      console.warn(`Metric icon update failed: ${result}`)
    }
  }

  const postImageData = async (url: string): Promise<string> => {
    let pending = postImageCache.get(url)
    if (!pending) {
      pending = loadPostImage(url).then(renderPostImage)
      postImageCache.set(url, pending)
      if (postImageCache.size > 32) postImageCache.delete(postImageCache.keys().next().value ?? '')
    }
    try {
      return await pending
    } catch (error) {
      postImageCache.delete(url)
      console.warn('Unable to load post image', error)
      return renderPostImagePlaceholder()
    }
  }

  const updatePostImage = async (url: string, force = false): Promise<void> => {
    if (!force && renderedPostImageUrl === url) return
    const result = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: POST_IMAGE_ID,
        containerName: POST_IMAGE_NAME,
        imageData: await postImageData(url),
      }),
    )
    if (result !== ImageRawDataUpdateResult.success) {
      console.warn(`Post image update failed: ${result}`)
      return
    }
    renderedPostImageUrl = url
  }

  const rememberTextLengths = (textObject: TextContainerProperty[]): void => {
    renderedLengths.clear()
    for (const text of textObject) {
      renderedLengths.set(text.containerID ?? 0, text.content?.length ?? 0)
    }
  }

  const refreshPageImages = async (
    sections: ReturnType<typeof renderGlassesSections>,
    force: boolean,
  ): Promise<void> => {
    await updateAvatar(sections.avatarUrl, force)
    await updateMetricStrip()
    if (sections.postImageUrl) await updatePostImage(sections.postImageUrl, force)
    else renderedPostImageUrl = null
  }

  const initial = renderGlassesSections(state, bodyPage)
  const initialPage = page(initial)
  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: initialPage.textObject.length + initialPage.imageObject.length,
      textObject: initialPage.textObject,
      imageObject: initialPage.imageObject,
    }),
  )
  if (result !== StartUpPageCreateResult.success)
    throw new Error(`Unable to create G2 page: ${result}`)
  rememberTextLengths(initialPage.textObject)
  renderedHasPostImage = initialPage.hasPostImage
  await refreshPageImages(initial, true)

  const draw = async (): Promise<void> => {
    const sections = renderGlassesSections(state, bodyPage)
    const nextPage = page(sections)
    let needsRebuild = nextPage.hasPostImage !== renderedHasPostImage
    if (!needsRebuild) {
      for (const text of nextPage.textObject) {
        const containerID = text.containerID ?? 0
        const containerName = text.containerName ?? ''
        const content = text.content ?? ''
        const upgraded = await bridge.textContainerUpgrade(
          new TextContainerUpgrade({
            containerID,
            containerName,
            contentOffset: 0,
            contentLength: renderedLengths.get(containerID) ?? 0,
            content,
          }),
        )
        if (!upgraded) {
          needsRebuild = true
          break
        }
        renderedLengths.set(containerID, content.length)
      }
    }
    if (needsRebuild) {
      await bridge.rebuildPageContainer(
        new RebuildPageContainer({
          containerTotalNum: nextPage.textObject.length + nextPage.imageObject.length,
          textObject: nextPage.textObject,
          imageObject: nextPage.imageObject,
        }),
      )
      rememberTextLengths(nextPage.textObject)
      renderedHasPostImage = nextPage.hasPostImage
      await refreshPageImages(sections, true)
      return
    }
    await updateAvatar(sections.avatarUrl)
    if (sections.postImageUrl) await updatePostImage(sections.postImageUrl)
  }
  updateGlasses = () => {
    const task = bridgeQueue.then(draw)
    bridgeQueue = task.catch((error: unknown) => console.error(error))
    return task
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

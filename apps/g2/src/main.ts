import './style.css'
import type { PostImageKind } from '@even-g2-x-reader/contracts'
import {
  CreateStartUpPageContainer,
  ImageContainerProperty,
  ImageRawDataUpdate,
  ImageRawDataUpdateResult,
  ListContainerProperty,
  ListItemContainerProperty,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { getTextWidth } from '@evenrealities/pretext'
import { loadAvatarImage, loadPostImage, loadThread, loadTimeline, setReaction } from './api.js'
import { browserAccessToken, clearBrowserAccessToken, saveBrowserAccessToken } from './auth.js'
import { registerBackgroundState } from './background-state.js'
import {
  VIEW_OPTIONS,
  doubleTapDestination,
  feedForViewIndex,
  type AppLayer,
} from './app-navigation.js'
import { canvasPngBytes } from './image-bytes.js'
import { classifyInput, type InputAction } from './input.js'
import { LatestRenderEpoch, renderLatestImage } from './latest-image.js'
import {
  METRIC_ICON_SIZE,
  METRIC_STRIP_WIDTH,
  renderMetricIconStrip,
  type MetricIconKind,
} from './metric-icons.js'
import {
  METRIC_FOOTER_LAYOUT,
  METRIC_STRIP_X,
  METRIC_STRIP_Y,
  centreMetricCount,
} from './metric-layout.js'
import {
  FULLSCREEN_IMAGE_TILES,
  renderPostImagePlaceholderTiles,
  renderPostImageTiles,
  type FullscreenImageTileData,
} from './post-image.js'
import { renderGlassesSections } from './presentation.js'
import { reactionMenuItems, reactionSelection } from './reaction-menu.js'
import {
  initialReaderState,
  readerSnapshot,
  reduceReaderState,
  restoreReaderSnapshot,
  type ReaderState,
} from './reader-state.js'

const POSITION_ID = 1
const AUTHOR_ID = 2
const BODY_ID = 3
const AVATAR_ID = 4
const REPLY_COUNT_ID = 5
const REPOST_COUNT_ID = 6
const LIKE_COUNT_ID = 7
const VIEW_COUNT_ID = 8
const METRIC_STRIP_ID = 9
const ACTION_MENU_BACKGROUND_ID = 11
const ACTION_MENU_ID = 12
const BOOKMARK_COUNT_ID = 13
const POST_IMAGE_INPUT_ID = 30
const VIEW_TITLE_ID = 20
const VIEW_LIST_ID = 22
const POSITION_NAME = 'doge_position'
const AUTHOR_NAME = 'doge_author'
const BODY_NAME = 'doge_body'
const AVATAR_NAME = 'doge_avatar'
const REPLY_COUNT_NAME = 'doge_reply_num'
const REPOST_COUNT_NAME = 'doge_rp_num'
const LIKE_COUNT_NAME = 'doge_like_num'
const VIEW_COUNT_NAME = 'doge_view_num'
const BOOKMARK_COUNT_NAME = 'doge_bm_num'
const METRIC_STRIP_NAME = 'doge_metrics'
const POST_IMAGE_INPUT_NAME = 'doge_img_input'
const POST_IMAGE_TILE_CONFIG = [
  { containerID: 31, containerName: 'doge_img_0', dataIndex: 0 },
  { containerID: 32, containerName: 'doge_img_1', dataIndex: 1 },
  { containerID: 33, containerName: 'doge_img_2', dataIndex: 2 },
  { containerID: 34, containerName: 'doge_img_3', dataIndex: 3 },
] as const
const ACTION_MENU_NAME = 'doge_actions'
const ACTION_MENU_BACKGROUND_NAME = 'doge_action_bg'
const VIEW_TITLE_NAME = 'doge_view_title'
const VIEW_TITLE = 'DOGE  ·  SELECT VIEW'
const VIEW_TITLE_WIDTH = Math.ceil(getTextWidth(VIEW_TITLE))
const VIEW_TITLE_X = Math.floor((576 - VIEW_TITLE_WIDTH) / 2)
const VIEW_LIST_NAME = 'doge_view_list'
const AVATAR_SIZE = 48
const AUTHOR_Y = 2
const AVATAR_Y = 4
const BODY_Y = 64
const PLAIN_BODY_HEIGHT = 190
const POSITION_X = 478
const POSITION_WIDTH = 90

interface MetricText {
  kind: MetricIconKind
  countID: number
  countName: string
}

const METRIC_TEXT: Readonly<Record<MetricIconKind, MetricText>> = {
  reply: { kind: 'reply', countID: REPLY_COUNT_ID, countName: REPLY_COUNT_NAME },
  repost: { kind: 'repost', countID: REPOST_COUNT_ID, countName: REPOST_COUNT_NAME },
  like: { kind: 'like', countID: LIKE_COUNT_ID, countName: LIKE_COUNT_NAME },
  view: { kind: 'view', countID: VIEW_COUNT_ID, countName: VIEW_COUNT_NAME },
  bookmark: {
    kind: 'bookmark',
    countID: BOOKMARK_COUNT_ID,
    countName: BOOKMARK_COUNT_NAME,
  },
}
let state: ReaderState = initialReaderState()
let appLayer: AppLayer = 'view-select'
let bodyPage = 0
let updateGlasses: ((epoch: number) => Promise<void>) | undefined
const latestRenderEpoch = new LatestRenderEpoch()
let stateRevision = 0
let menuOpen = false
let menuError: string | null = null

function element(id: string): HTMLElement | null {
  return document.getElementById(id)
}

function updatePhone(): void {
  const post = state.posts[state.index]
  const connection = element('connection')
  if (appLayer === 'view-select') {
    if (connection) {
      connection.textContent = 'Choose a view on G2'
      connection.dataset.state = 'ready'
    }
    if (element('feed')) element('feed')!.textContent = 'SELECT VIEW'
    if (element('author')) element('author')!.textContent = 'Home · Following · Bookmarks'
    if (element('post')) element('post')!.textContent = 'Tap a view to open its timeline.'
    if (element('position')) element('position')!.textContent = 'Double tap here to exit Doge'
    element('pairing')?.toggleAttribute('hidden', Boolean(browserAccessToken()))
    element('forget-device')?.toggleAttribute('hidden', !browserAccessToken())
    return
  }
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
  const epoch = latestRenderEpoch.issue()
  updatePhone()
  await updateGlasses?.(epoch)
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

async function openView(feed: (typeof VIEW_OPTIONS)[number]['feed']): Promise<void> {
  stateRevision += 1
  appLayer = 'reader'
  menuOpen = false
  menuError = null
  bodyPage = 0
  state = reduceReaderState(state, { type: 'select-feed', feed })
  await loadCurrentFeed()
}

async function returnToViewSelection(): Promise<void> {
  appLayer = 'view-select'
  menuOpen = false
  menuError = null
  bodyPage = 0
  await render()
}

async function handleAction(action: InputAction): Promise<void> {
  if (!action || action === 'cleanup' || action === 'double-tap' || appLayer !== 'reader') return
  if (action === 'open-menu') {
    if (state.status === 'error') {
      await loadCurrentFeed()
      return
    }
    if (state.status !== 'ready' || !state.posts[state.index]) return
    menuOpen = true
    menuError = null
    await render()
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

async function handleMenuSelection(index: number): Promise<void> {
  const post = state.posts[state.index]
  if (!post) return
  const adjustedIndex = menuError ? index - 1 : index
  if (adjustedIndex < 0) return
  const selection = reactionSelection(post, adjustedIndex)
  if (!selection) return
  if (selection === 'close') {
    menuOpen = false
    menuError = null
    await render()
    return
  }
  if (selection === 'thread') {
    menuOpen = false
    menuError = null
    await handleAction('toggle-detail')
    return
  }
  try {
    const result = await setReaction(post.id, selection.reaction, selection.active)
    state = reduceReaderState(state, { type: 'reaction-updated', ...result })
    menuOpen = false
    menuError = null
  } catch (error) {
    menuError = error instanceof Error ? `Update failed: ${error.message}` : 'Update failed'
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
    menuOpen = false
    menuError = null
    void render()
  },
)

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
  button.addEventListener('click', () => void handleAction(button.dataset.action as InputAction))
}
for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-feed]')) {
  button.addEventListener('click', () => {
    const feed = VIEW_OPTIONS.find((option) => option.feed === button.dataset.feed)?.feed
    if (feed) void openView(feed)
  })
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
  appLayer = 'view-select'
  bodyPage = 0
  menuOpen = false
  menuError = null
  void render()
})
element('forget-device')?.addEventListener('click', () => {
  clearBrowserAccessToken()
  stateRevision += 1
  state = { ...initialReaderState(), status: 'error', error: 'Access key required on this iPhone' }
  appLayer = 'view-select'
  bodyPage = 0
  menuOpen = false
  menuError = null
  void render()
})
updatePhone()

async function startGlasses(): Promise<void> {
  const bridge = await waitForEvenAppBridge()
  const renderedLengths = new Map<number, number>()
  const avatarCache = new Map<string, Promise<Uint8Array>>()
  const postImageCache = new Map<string, Promise<FullscreenImageTileData>>()
  let renderedAvatarUrl: string | null | undefined
  let renderedPostImageKey: string | null | undefined
  let renderedMenuSignature = ''
  let renderedMetricSignature = ''
  let renderedPageKind: AppLayer | 'post-image' = 'view-select'
  let bridgeQueue = Promise.resolve()

  interface AvatarData {
    bytes: Uint8Array
    matchesUrl: boolean
  }

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
      yPosition: AVATAR_Y,
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      containerID: AVATAR_ID,
      containerName: AVATAR_NAME,
      zOrderIndex: 4,
    })

  const metricStripContainer = () =>
    new ImageContainerProperty({
      xPosition: METRIC_STRIP_X,
      yPosition: METRIC_STRIP_Y,
      width: METRIC_STRIP_WIDTH,
      height: METRIC_ICON_SIZE,
      containerID: METRIC_STRIP_ID,
      containerName: METRIC_STRIP_NAME,
      zOrderIndex: 6,
    })

  const postImageTileContainers = () =>
    POST_IMAGE_TILE_CONFIG.map((config, index) => {
      const tile = FULLSCREEN_IMAGE_TILES[config.dataIndex]
      return new ImageContainerProperty({
        xPosition: tile.x,
        yPosition: tile.y,
        width: tile.width,
        height: tile.height,
        containerID: config.containerID,
        containerName: config.containerName,
        zOrderIndex: index + 1,
      })
    })

  const actionMenu = (items: string[]) =>
    new ListContainerProperty({
      xPosition: 316,
      yPosition: 72,
      width: 252,
      height: 144,
      borderWidth: 2,
      borderColor: 15,
      borderRadius: 6,
      paddingLength: 4,
      containerID: ACTION_MENU_ID,
      containerName: ACTION_MENU_NAME,
      isEventCapture: 1,
      zOrderIndex: 14,
      itemContainer: new ListItemContainerProperty({
        itemCount: items.length,
        itemWidth: 0,
        isItemSelectBorderEn: 1,
        itemName: items,
      }),
    })

  const actionMenuBackground = () =>
    new ImageContainerProperty({
      xPosition: 316,
      yPosition: 72,
      width: 252,
      height: 144,
      containerID: ACTION_MENU_BACKGROUND_ID,
      containerName: ACTION_MENU_BACKGROUND_NAME,
      zOrderIndex: 13,
    })

  const viewList = () =>
    new ListContainerProperty({
      xPosition: 72,
      yPosition: 50,
      width: 432,
      height: 230,
      borderWidth: 2,
      borderColor: 15,
      borderRadius: 6,
      paddingLength: 8,
      containerID: VIEW_LIST_ID,
      containerName: VIEW_LIST_NAME,
      isEventCapture: 1,
      zOrderIndex: 2,
      itemContainer: new ListItemContainerProperty({
        itemCount: VIEW_OPTIONS.length,
        itemWidth: 0,
        isItemSelectBorderEn: 1,
        itemName: VIEW_OPTIONS.map((option) => option.label),
      }),
    })

  const selectionPage = () => ({
    pageKind: 'view-select' as const,
    textObject: [
      textContainer(
        VIEW_TITLE_ID,
        VIEW_TITLE_NAME,
        VIEW_TITLE_X,
        8,
        VIEW_TITLE_WIDTH,
        34,
        1,
        VIEW_TITLE,
      ),
    ],
    imageObject: [],
    listObject: [viewList()],
    menuSignature: '',
  })

  const readerPage = (sections: ReturnType<typeof renderGlassesSections>) => {
    const post = state.posts[state.index]
    const menuItems =
      menuOpen && post
        ? [
            ...(menuError ? [menuError.slice(0, 64)] : []),
            ...reactionMenuItems(post).map((item) =>
              item === 'Open thread' && state.mode === 'thread' ? 'Close thread' : item,
            ),
          ]
        : []
    const textObject = [
      ...(menuItems.length === 0
        ? [
            textContainer(
              POSITION_ID,
              POSITION_NAME,
              POSITION_X,
              258,
              POSITION_WIDTH,
              28,
              12,
              sections.position,
            ),
          ]
        : []),
      textContainer(AUTHOR_ID, AUTHOR_NAME, 72, AUTHOR_Y, 492, 58, 2, sections.author),
      textContainer(
        BODY_ID,
        BODY_NAME,
        8,
        BODY_Y,
        560,
        PLAIN_BODY_HEIGHT,
        3,
        sections.body,
        menuOpen ? 0 : 1,
      ),
      ...METRIC_FOOTER_LAYOUT.map((layout, index) => {
        const metric = METRIC_TEXT[layout.kind]
        return textContainer(
          metric.countID,
          metric.countName,
          layout.countX,
          layout.countY,
          layout.countWidth,
          layout.countHeight,
          7 + index,
          centreMetricCount(sections.metricCounts[layout.kind], layout.countWidth),
        )
      }),
    ]
    return {
      pageKind: 'reader' as const,
      textObject,
      imageObject: [
        avatarContainer(),
        metricStripContainer(),
        ...(menuItems.length > 0 ? [actionMenuBackground()] : []),
      ],
      listObject: menuItems.length > 0 ? [actionMenu(menuItems)] : [],
      menuSignature: menuItems.join('\u0000'),
    }
  }

  const postImagePage = () => ({
    pageKind: 'post-image' as const,
    textObject: [
      textContainer(POST_IMAGE_INPUT_ID, POST_IMAGE_INPUT_NAME, 0, 0, 576, 288, 0, ' ', 1),
    ],
    imageObject: postImageTileContainers(),
    listObject: [],
    menuSignature: '',
  })

  const page = (sections: ReturnType<typeof renderGlassesSections>) => {
    if (appLayer === 'view-select') return selectionPage()
    if (sections.postImageUrl && !menuOpen) return postImagePage()
    return readerPage(sections)
  }

  const fallbackAvatar = (): Uint8Array => {
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
    return canvasPngBytes(canvas)
  }

  const menuBackgroundData = (): Uint8Array => {
    const canvas = document.createElement('canvas')
    canvas.width = 252
    canvas.height = 144
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = '#000'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.strokeStyle = '#fff'
      context.lineWidth = 2
      context.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)
    }
    return canvasPngBytes(canvas)
  }

  const updateMenuBackground = async (): Promise<void> => {
    if (!menuOpen) return
    const result = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: ACTION_MENU_BACKGROUND_ID,
        containerName: ACTION_MENU_BACKGROUND_NAME,
        imageData: menuBackgroundData(),
      }),
    )
    if (result !== ImageRawDataUpdateResult.success) {
      console.warn(`Action menu background update failed: ${result}`)
    }
  }

  const avatarData = async (url: string | null): Promise<AvatarData> => {
    if (!url) return { bytes: fallbackAvatar(), matchesUrl: true }
    let pending = avatarCache.get(url)
    if (!pending) {
      pending = loadAvatarImage(url)
      avatarCache.set(url, pending)
      if (avatarCache.size > 64) avatarCache.delete(avatarCache.keys().next().value ?? '')
    }
    try {
      return { bytes: await pending, matchesUrl: true }
    } catch (error) {
      avatarCache.delete(url)
      console.warn('Unable to load avatar', error)
      return { bytes: fallbackAvatar(), matchesUrl: false }
    }
  }

  const updateAvatar = async (url: string | null, force: boolean, epoch: number): Promise<void> => {
    if (force) renderedAvatarUrl = undefined
    if (!force && renderedAvatarUrl === url) return
    const outcome = await renderLatestImage({
      load: () => avatarData(url),
      isCurrent: () => latestRenderEpoch.isCurrent(epoch) && appLayer === 'reader',
      draw: async (avatar) => {
        const result = await bridge.updateImageRawData(
          new ImageRawDataUpdate({
            containerID: AVATAR_ID,
            containerName: AVATAR_NAME,
            imageData: avatar.bytes,
          }),
        )
        if (result !== ImageRawDataUpdateResult.success) {
          console.warn(`Avatar update failed: ${result}`)
          return false
        }
        return true
      },
    })
    if (outcome.status !== 'rendered') {
      renderedAvatarUrl = undefined
      return
    }
    // A fallback for a transient fetch failure is not proof that this URL rendered.
    renderedAvatarUrl = outcome.value.matchesUrl ? url : undefined
  }

  const updateMetricStrip = async (force = false): Promise<void> => {
    const post = state.posts[state.index]
    const metricState = {
      viewerHasLiked: post?.viewerHasLiked ?? false,
      viewerHasReposted: post?.viewerHasReposted ?? false,
      viewerHasBookmarked: post?.viewerHasBookmarked ?? false,
    }
    const signature = JSON.stringify(metricState)
    if (!force && signature === renderedMetricSignature) return
    const result = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: METRIC_STRIP_ID,
        containerName: METRIC_STRIP_NAME,
        imageData: renderMetricIconStrip(metricState),
      }),
    )
    if (result !== ImageRawDataUpdateResult.success) {
      console.warn(`Metric icon update failed: ${result}`)
      return
    }
    renderedMetricSignature = signature
  }

  const postImageData = async (
    url: string,
    kind: PostImageKind,
  ): Promise<FullscreenImageTileData> => {
    const key = `${kind}:${url}`
    let pending = postImageCache.get(key)
    if (!pending) {
      pending = loadPostImage(url).then((image) => renderPostImageTiles(image, kind))
      postImageCache.set(key, pending)
      if (postImageCache.size > 8) postImageCache.delete(postImageCache.keys().next().value ?? '')
    }
    try {
      return await pending
    } catch (error) {
      postImageCache.delete(key)
      console.warn('Unable to load post image', error)
      return renderPostImagePlaceholderTiles(kind)
    }
  }

  const updatePostImage = async (
    url: string,
    kind: PostImageKind,
    force = false,
  ): Promise<void> => {
    const key = `${kind}:${url}`
    if (!force && renderedPostImageKey === key) return
    const tiles = await postImageData(url, kind)
    for (const config of POST_IMAGE_TILE_CONFIG) {
      const result = await bridge.updateImageRawData(
        new ImageRawDataUpdate({
          containerID: config.containerID,
          containerName: config.containerName,
          imageData: tiles[config.dataIndex],
        }),
      )
      if (result !== ImageRawDataUpdateResult.success) {
        console.warn(`Post image tile ${config.dataIndex + 1} update failed: ${result}`)
        return
      }
    }
    renderedPostImageKey = key
  }

  const rememberTextLengths = (textObject: TextContainerProperty[]): void => {
    renderedLengths.clear()
    for (const text of textObject) {
      renderedLengths.set(text.containerID ?? 0, text.content?.length ?? 0)
    }
  }

  const refreshReaderPageImages = async (
    sections: ReturnType<typeof renderGlassesSections>,
    force: boolean,
    epoch: number,
  ): Promise<void> => {
    await updateAvatar(sections.avatarUrl, force, epoch)
    if (!latestRenderEpoch.isCurrent(epoch)) return
    await updateMetricStrip(force)
    if (!latestRenderEpoch.isCurrent(epoch)) return
    await updateMenuBackground()
  }

  const initial = renderGlassesSections(state, bodyPage)
  const initialPage = page(initial)
  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum:
        initialPage.textObject.length +
        initialPage.imageObject.length +
        initialPage.listObject.length,
      listObject: initialPage.listObject,
      textObject: initialPage.textObject,
      imageObject: initialPage.imageObject,
    }),
  )
  if (result !== StartUpPageCreateResult.success)
    throw new Error(`Unable to create G2 page: ${result}`)
  rememberTextLengths(initialPage.textObject)
  renderedMenuSignature = initialPage.menuSignature
  renderedPageKind = initialPage.pageKind
  if (initialPage.pageKind === 'reader') {
    const epoch = latestRenderEpoch.issue()
    await refreshReaderPageImages(initial, true, epoch)
  }

  const draw = async (epoch: number): Promise<void> => {
    if (!latestRenderEpoch.isCurrent(epoch)) return
    const sections = renderGlassesSections(state, bodyPage)
    const nextPage = page(sections)
    let needsRebuild =
      nextPage.pageKind !== renderedPageKind || nextPage.menuSignature !== renderedMenuSignature
    if (!needsRebuild && nextPage.pageKind !== 'post-image') {
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
          containerTotalNum:
            nextPage.textObject.length + nextPage.imageObject.length + nextPage.listObject.length,
          listObject: nextPage.listObject,
          textObject: nextPage.textObject,
          imageObject: nextPage.imageObject,
        }),
      )
      rememberTextLengths(nextPage.textObject)
      renderedMenuSignature = nextPage.menuSignature
      renderedPageKind = nextPage.pageKind
      if (nextPage.pageKind === 'reader') {
        await refreshReaderPageImages(sections, true, epoch)
        renderedPostImageKey = undefined
      } else if (
        nextPage.pageKind === 'post-image' &&
        sections.postImageUrl &&
        sections.postImageKind
      ) {
        renderedAvatarUrl = undefined
        renderedMetricSignature = ''
        await updatePostImage(sections.postImageUrl, sections.postImageKind, true)
      } else {
        renderedAvatarUrl = undefined
        renderedPostImageKey = undefined
        renderedMetricSignature = ''
      }
      return
    }
    if (nextPage.pageKind === 'reader') {
      await updateAvatar(sections.avatarUrl, false, epoch)
      if (!latestRenderEpoch.isCurrent(epoch)) return
      await updateMetricStrip()
      return
    }
    if (nextPage.pageKind === 'post-image' && sections.postImageUrl && sections.postImageKind) {
      await updatePostImage(sections.postImageUrl, sections.postImageKind)
    }
  }
  updateGlasses = (epoch) => {
    const task = bridgeQueue.then(() => draw(epoch))
    bridgeQueue = task.catch((error: unknown) => console.error(error))
    return task
  }

  let queue = Promise.resolve()
  const unsubscribe = bridge.onEvenHubEvent((event: EvenHubEvent) => {
    queue = queue
      .then(async () => {
        const action = classifyInput(event)
        if (action === 'double-tap') {
          if (doubleTapDestination(appLayer) === 'exit') {
            await bridge.shutDownPageContainer(1)
          } else {
            await returnToViewSelection()
          }
          return
        }
        if (action === 'cleanup') {
          unsubscribe()
          return
        }
        if (appLayer === 'view-select') {
          if (event.listEvent && (event.listEvent.eventType ?? 0) === 0) {
            const feed = feedForViewIndex(event.listEvent.currentSelectItemIndex ?? 0)
            if (feed) await openView(feed)
          }
          return
        }
        if (menuOpen && event.listEvent && (event.listEvent.eventType ?? 0) === 0) {
          // Protobuf omits zero-valued scalars, so the first item arrives without an index.
          await handleMenuSelection(event.listEvent.currentSelectItemIndex ?? 0)
          return
        }
        await handleAction(action)
      })
      .catch((error: unknown) => console.error(error))
  })
  await render()
}

void startGlasses().catch((error: unknown) => {
  console.warn('Even Hub bridge is not available in this browser', error)
  void render()
})

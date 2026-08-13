import './style.css'
import type { Post, PostImageKind } from '@even-g2-x-reader/contracts'
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
import {
  loadAvatarImage,
  loadPostImage,
  loadProfile,
  loadThread,
  loadTimeline,
  setReaction,
} from './api.js'
import { ACTION_MENU_BACKGROUND_TILES, ACTION_MENU_BOUNDS } from './action-menu-layout.js'
import { browserAccessToken, clearBrowserAccessToken, saveBrowserAccessToken } from './auth.js'
import { registerBackgroundState } from './background-state.js'
import { VIEW_OPTIONS, backDestination, feedForViewIndex, type AppLayer } from './app-navigation.js'
import { canvasPngBytes } from './image-bytes.js'
import { galleryTitle, slideGalleryIndex } from './gallery.js'
import { classifyInput, type SwipeDirection } from './input.js'
import { LatestRenderEpoch, renderLatestImage } from './latest-image.js'
import {
  imageLoadingIndicator,
  loadingIndicator,
  type ImageLoadingProgress,
  type LoadingOperation,
  type LoadingProgress,
  type LoadingStage,
} from './loading-progress.js'
import { LOADING_LOGO_LAYOUT, LOADING_LOGO_SOURCE, shouldShowLoadingLogo } from './loading-logo.js'
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
  type PostImageLayout,
} from './post-image.js'
import { renderGlassesSections } from './presentation.js'
import { profileSummary } from './profile-presentation.js'
import { initialProfileState, reduceProfileState, type ProfileState } from './profile-state.js'
import { reactionMenuItems, reactionSelection } from './reaction-menu.js'
import {
  initialReaderState,
  readerSnapshot,
  reduceReaderState,
  restoreReaderSnapshot,
  type ReaderState,
} from './reader-state.js'
import { shouldReloadTimeline } from './timeline-navigation.js'
import { loadViewHistory, saveViewHistory } from './view-history.js'

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
const ACTION_MENU_BACKGROUND_BOTTOM_ID = 14
const POST_IMAGE_INPUT_ID = 30
const POST_IMAGE_LOADING_ID = 35
const VIEW_TITLE_ID = 20
const VIEW_LIST_ID = 22
const LOADING_TITLE_ID = 40
const LOADING_PROGRESS_ID = 41
const LOADING_STATUS_ID = 42
const PROFILE_STATS_ID = 43
const LOADING_LOGO_ID = 44
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
const POST_IMAGE_LOADING_NAME = 'doge_img_load'
const POST_IMAGE_TILE_CONFIG = [
  { containerID: 31, containerName: 'doge_img_0', dataIndex: 0 },
  { containerID: 32, containerName: 'doge_img_1', dataIndex: 1 },
  { containerID: 33, containerName: 'doge_img_2', dataIndex: 2 },
  { containerID: 34, containerName: 'doge_img_3', dataIndex: 3 },
] as const
const ACTION_MENU_NAME = 'doge_actions'
const ACTION_MENU_BACKGROUND_NAME = 'doge_action_bg'
const ACTION_MENU_BACKGROUND_BOTTOM_NAME = 'doge_action_bg2'
const VIEW_TITLE_NAME = 'doge_view_title'
const VIEW_TITLE = 'DOGE  ·  SELECT VIEW'
const VIEW_TITLE_WIDTH = Math.ceil(getTextWidth(VIEW_TITLE))
const VIEW_TITLE_X = Math.floor((576 - VIEW_TITLE_WIDTH) / 2)
const VIEW_LIST_NAME = 'doge_view_list'
const LOADING_TITLE_NAME = 'doge_load_title'
const LOADING_PROGRESS_NAME = 'doge_load_bar'
const LOADING_STATUS_NAME = 'doge_load_state'
const PROFILE_STATS_NAME = 'doge_prof_stats'
const LOADING_LOGO_NAME = 'doge_load_logo'
const AVATAR_SIZE = 48
const AUTHOR_Y = 2
const AVATAR_Y = 4
const BODY_Y = 64
const PLAIN_BODY_HEIGHT = 190
const POSITION_X = 478
const POSITION_WIDTH = 90

const ACTION_MENU_BACKGROUND_CONFIG = [
  {
    ...ACTION_MENU_BACKGROUND_TILES[0],
    containerID: ACTION_MENU_BACKGROUND_ID,
    containerName: ACTION_MENU_BACKGROUND_NAME,
    zOrderIndex: 13,
  },
  {
    ...ACTION_MENU_BACKGROUND_TILES[1],
    containerID: ACTION_MENU_BACKGROUND_BOTTOM_ID,
    containerName: ACTION_MENU_BACKGROUND_BOTTOM_NAME,
    zOrderIndex: 14,
  },
] as const

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
let state: ReaderState = {
  ...initialReaderState(),
  viewedPostIds: loadViewHistory(window.localStorage),
}
let appLayer: AppLayer = 'view-select'
let bodyPage = 0
let updateGlasses: ((epoch: number) => Promise<void>) | undefined
const latestRenderEpoch = new LatestRenderEpoch()
let stateRevision = 0
let menuOpen = false
let menuError: string | null = null
let galleryImageIndex = 0
let threadReturnBodyPage = 0
let loadingProgress: LoadingProgress | null = null
let profileState: ProfileState | null = null
let profileBodyPage = 0
let profileRevision = 0

type ReaderCommand = SwipeDirection | 'confirm' | 'toggle-detail'

function element(id: string): HTMLElement | null {
  return document.getElementById(id)
}

function feedLabel(): string {
  return VIEW_OPTIONS.find((option) => option.feed === state.feed)?.label ?? state.feed
}

function currentLoadingProgress(): LoadingProgress {
  return (
    loadingProgress ?? {
      operation: 'initial',
      stage: 'connecting',
      target: feedLabel(),
    }
  )
}

function profilePost(): Post | undefined {
  const position = profileState?.position
  return typeof position === 'number' ? profileState?.posts[position] : undefined
}

function profileReaderState(): ReaderState | null {
  if (!profileState || typeof profileState.position !== 'number') return null
  return {
    feed: state.feed,
    posts: profileState.posts,
    index: profileState.position,
    nextCursor: profileState.nextCursor,
    mode: 'timeline',
    status: profileState.status,
    error: profileState.error,
    returnTo: null,
    viewedPostIds: state.viewedPostIds,
  }
}

function activePost(): Post | undefined {
  return appLayer === 'profile' ? profilePost() : state.posts[state.index]
}

function renderActiveSections(): ReturnType<typeof renderGlassesSections> {
  const profileReader = profileReaderState()
  return profileReader
    ? renderGlassesSections(profileReader, profileBodyPage)
    : renderGlassesSections(state, bodyPage, loadingProgress ?? undefined)
}

function updatePhoneImageLoading(progress: ImageLoadingProgress | null): void {
  if (!progress) {
    updatePhone()
    return
  }
  const indicator = imageLoadingIndicator(progress)
  const connection = element('connection')
  if (connection) {
    connection.textContent = `${indicator.title} · ${indicator.percent}%`
    connection.dataset.state = 'loading'
  }
  if (element('feed')) element('feed')!.textContent = indicator.title
  if (element('author')) element('author')!.textContent = indicator.label
  if (element('post')) element('post')!.textContent = indicator.progressLine
  if (element('position')) element('position')!.textContent = `${indicator.percent}%`
}

function updatePhone(): void {
  const post = activePost()
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
  if (appLayer === 'profile') {
    if (profileState?.status === 'loading') {
      const indicator = loadingIndicator(currentLoadingProgress())
      if (connection) {
        connection.textContent = `${indicator.title} · ${indicator.percent}%`
        connection.dataset.state = 'loading'
      }
      if (element('feed')) element('feed')!.textContent = indicator.title
      if (element('author')) element('author')!.textContent = indicator.label
      if (element('post')) element('post')!.textContent = indicator.progressLine
      if (element('position')) element('position')!.textContent = `${indicator.percent}%`
      return
    }
    if (profileState?.status === 'error') {
      if (connection) {
        connection.textContent = profileState.error ?? 'Unable to load profile'
        connection.dataset.state = 'error'
      }
      if (element('feed')) element('feed')!.textContent = 'PROFILE'
      if (element('author')) element('author')!.textContent = `@${profileState.handle}`
      if (element('post')) element('post')!.textContent = 'Unable to load this profile.'
      if (element('position')) element('position')!.textContent = 'Double tap G2 to return'
      return
    }
    if (profileState?.position === 'summary' && profileState.profile) {
      const summary = profileSummary(profileState.profile)
      if (connection) {
        connection.textContent = 'Profile open on G2'
        connection.dataset.state = 'ready'
      }
      if (element('feed')) element('feed')!.textContent = 'PROFILE'
      if (element('author')) element('author')!.textContent = summary.author.replace('\n', ' · ')
      if (element('post')) element('post')!.textContent = summary.body || 'No bio'
      if (element('position')) element('position')!.textContent = summary.stats
      return
    }
    if (connection) {
      connection.textContent = 'Profile posts open on G2'
      connection.dataset.state = 'ready'
    }
    if (element('feed')) element('feed')!.textContent = 'PROFILE POSTS'
    if (element('author'))
      element('author')!.textContent = post
        ? `${post.authorName} · @${post.authorHandle}`
        : 'No post selected'
    if (element('post')) element('post')!.textContent = post?.text ?? 'No posts found.'
    if (element('position'))
      element('position')!.textContent =
        post && typeof profileState?.position === 'number'
          ? `${profileState.position + 1} / ${profileState.posts.length}`
          : '—'
    return
  }
  if (appLayer === 'gallery') {
    if (connection) {
      connection.textContent = 'Gallery open on G2'
      connection.dataset.state = 'ready'
    }
    if (element('feed')) element('feed')!.textContent = 'GALLERY'
    if (element('author'))
      element('author')!.textContent = post
        ? `${post.authorName} · @${post.authorHandle}`
        : 'No post selected'
    if (element('post'))
      element('post')!.textContent = post
        ? `Image ${galleryImageIndex + 1} of ${post.images.length}`
        : 'No image selected'
    if (element('position')) element('position')!.textContent = 'Double tap G2 to return'
    return
  }
  if (state.status === 'loading') {
    const indicator = loadingIndicator(currentLoadingProgress())
    if (connection) {
      connection.textContent = `${indicator.title} · ${indicator.percent}%`
      connection.dataset.state = 'loading'
    }
    if (element('feed')) element('feed')!.textContent = indicator.title
    if (element('author')) element('author')!.textContent = indicator.label
    if (element('post')) element('post')!.textContent = indicator.progressLine
    if (element('position')) element('position')!.textContent = `${indicator.percent}%`
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
  const glassesUpdater = updateGlasses
  if (!glassesUpdater) return
  await glassesUpdater(epoch)
  if (!latestRenderEpoch.isCurrent(epoch) || loadingProgress) return
  const viewedPost =
    appLayer === 'reader' && state.status === 'ready'
      ? state.posts[state.index]
      : appLayer === 'profile' && profileState?.status === 'ready'
        ? profilePost()
        : undefined
  if (viewedPost) {
    state = reduceReaderState(state, { type: 'post-viewed', postId: viewedPost.id })
    saveViewHistory(window.localStorage, state.viewedPostIds)
  }
}

async function showLoadingStage(
  operation: LoadingOperation,
  target: string,
  stage: LoadingStage,
): Promise<void> {
  loadingProgress = { operation, target, stage }
  await render()
}

async function loadCurrentFeed(operation: LoadingOperation = 'initial'): Promise<void> {
  const revision = stateRevision
  const feed = state.feed
  const target = feedLabel()
  bodyPage = 0
  state = reduceReaderState(state, { type: 'timeline-loading' })
  await showLoadingStage(operation, target, 'connecting')
  try {
    const page = await loadTimeline(
      feed,
      undefined,
      async (stage) => {
        if (revision !== stateRevision || feed !== state.feed) return
        await showLoadingStage(operation, target, stage)
      },
      state.viewedPostIds,
    )
    if (revision !== stateRevision || feed !== state.feed) return
    await showLoadingStage(operation, target, 'rendering')
    state = reduceReaderState(state, {
      type: 'timeline-loaded',
      posts: page.posts,
      nextCursor: page.nextCursor,
    })
    loadingProgress = null
  } catch (error) {
    if (revision !== stateRevision || feed !== state.feed) return
    loadingProgress = null
    state = reduceReaderState(state, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  await render()
}

async function openView(feed: (typeof VIEW_OPTIONS)[number]['feed']): Promise<void> {
  stateRevision += 1
  profileRevision += 1
  appLayer = 'reader'
  menuOpen = false
  menuError = null
  galleryImageIndex = 0
  threadReturnBodyPage = 0
  loadingProgress = null
  profileState = null
  profileBodyPage = 0
  bodyPage = 0
  state = reduceReaderState(state, { type: 'select-feed', feed })
  await loadCurrentFeed('initial')
}

async function returnToViewSelection(): Promise<void> {
  profileRevision += 1
  appLayer = 'view-select'
  menuOpen = false
  menuError = null
  galleryImageIndex = 0
  threadReturnBodyPage = 0
  loadingProgress = null
  profileState = null
  profileBodyPage = 0
  bodyPage = 0
  await render()
}

async function returnToReader(): Promise<void> {
  profileRevision += 1
  appLayer = 'reader'
  menuOpen = false
  menuError = null
  loadingProgress = null
  profileState = null
  profileBodyPage = 0
  await render()
}

async function openProfile(handle: string): Promise<void> {
  profileRevision += 1
  const revision = profileRevision
  appLayer = 'profile'
  menuOpen = false
  menuError = null
  profileBodyPage = 0
  profileState = initialProfileState(handle)
  await showLoadingStage('profile', 'Profile', 'connecting')
  try {
    const page = await loadProfile(handle, undefined, async (stage) => {
      if (revision !== profileRevision) return
      await showLoadingStage('profile', 'Profile', stage)
    })
    if (revision !== profileRevision || !profileState) return
    await showLoadingStage('profile', 'Profile', 'rendering')
    profileState = reduceProfileState(profileState, { type: 'loaded', ...page })
    loadingProgress = null
  } catch (error) {
    if (revision !== profileRevision || !profileState) return
    loadingProgress = null
    profileState = reduceProfileState(profileState, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  await render()
}

async function reloadCurrentView(): Promise<void> {
  stateRevision += 1
  menuOpen = false
  menuError = null
  galleryImageIndex = 0
  threadReturnBodyPage = 0
  loadingProgress = null
  bodyPage = 0
  if (state.mode !== 'timeline') {
    state = reduceReaderState(state, { type: 'select-feed', feed: state.feed })
  }
  await loadCurrentFeed('reload')
}

async function loadMoreProfile(): Promise<boolean> {
  if (!profileState?.nextCursor) return false
  profileRevision += 1
  const revision = profileRevision
  const handle = profileState.handle
  const cursor = profileState.nextCursor
  profileState = reduceProfileState(profileState, { type: 'loading' })
  await showLoadingStage('profile', 'Profile', 'connecting')
  try {
    const page = await loadProfile(handle, cursor, async (stage) => {
      if (revision !== profileRevision) return
      await showLoadingStage('profile', 'Profile', stage)
    })
    if (revision !== profileRevision || !profileState) return false
    await showLoadingStage('profile', 'Profile', 'rendering')
    profileState = reduceProfileState(profileState, { type: 'appended', ...page })
    loadingProgress = null
    return true
  } catch (error) {
    if (revision !== profileRevision || !profileState) return false
    loadingProgress = null
    profileState = reduceProfileState(profileState, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Unknown error',
    })
    await render()
    return false
  }
}

async function handleProfileAction(action: ReaderCommand): Promise<void> {
  if (!profileState || action === 'confirm' || action === 'toggle-detail') return
  if (profileState.status !== 'ready') return
  if (profileState.position === 'summary') {
    if (action === 'next') {
      profileState = reduceProfileState(profileState, { type: 'next' })
      profileBodyPage = 0
      await render()
    }
    return
  }

  const reader = profileReaderState()
  if (!reader) return
  const sections = renderGlassesSections(reader, profileBodyPage)
  if (action === 'next' && profileBodyPage < sections.bodyPageCount - 1) {
    profileBodyPage += 1
    await render()
    return
  }
  if (action === 'previous' && profileBodyPage > 0) {
    profileBodyPage -= 1
    await render()
    return
  }
  if (
    action === 'next' &&
    profileState.position === profileState.posts.length - 1 &&
    profileState.nextCursor
  ) {
    if (!(await loadMoreProfile()) || !profileState || profileState.status !== 'ready') return
  }

  const previousPosition = profileState.position
  profileState = reduceProfileState(profileState, { type: action })
  if (profileState.position !== previousPosition) {
    if (profileState.position === 'summary' || action === 'next') {
      profileBodyPage = 0
    } else {
      const previousReader = profileReaderState()
      profileBodyPage = previousReader ? renderGlassesSections(previousReader).bodyPageCount - 1 : 0
    }
  }
  await render()
}

async function handleAction(action: ReaderCommand): Promise<void> {
  if (appLayer === 'gallery') {
    if (action !== 'next' && action !== 'previous') return
    const imageCount = state.posts[state.index]?.images.length ?? 0
    const nextIndex = slideGalleryIndex(galleryImageIndex, imageCount, action)
    if (nextIndex === galleryImageIndex) return
    galleryImageIndex = nextIndex
    await render()
    return
  }
  if (appLayer === 'profile') {
    await handleProfileAction(action)
    return
  }
  if (appLayer !== 'reader') return
  if (action === 'confirm') {
    if (state.status === 'error') {
      await loadCurrentFeed('reload')
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
      await loadCurrentFeed('reload')
      return
    }
    if (state.mode === 'thread') {
      state = reduceReaderState(state, { type: 'close-thread' })
      const restoredSections = renderGlassesSections(state, threadReturnBodyPage)
      bodyPage = Math.min(threadReturnBodyPage, restoredSections.bodyPageCount - 1)
      threadReturnBodyPage = 0
      await render()
      return
    }
    const current = state.posts[state.index]
    if (!current) return
    state = reduceReaderState(state, { type: 'timeline-loading' })
    await showLoadingStage('thread', 'Thread', 'connecting')
    try {
      const thread = await loadThread(current.id, async (stage) => {
        await showLoadingStage('thread', 'Thread', stage)
      })
      await showLoadingStage('thread', 'Thread', 'rendering')
      state = reduceReaderState(state, { type: 'thread-loaded', posts: thread.posts })
      threadReturnBodyPage = bodyPage
      bodyPage = 0
      loadingProgress = null
    } catch (error) {
      loadingProgress = null
      state = reduceReaderState(state, {
        type: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
    await render()
    return
  }
  if (
    (action === 'previous' || action === 'next') &&
    shouldReloadTimeline(action, state, bodyPage)
  ) {
    await reloadCurrentView()
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
      const page = await loadTimeline(state.feed, state.nextCursor, undefined, state.viewedPostIds)
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
  if (selection === 'gallery') {
    const sections = renderGlassesSections(state, bodyPage)
    galleryImageIndex = sections.postImageIndex ?? 0
    appLayer = 'gallery'
    menuOpen = false
    menuError = null
    await render()
    return
  }
  if (selection === 'reload') {
    await reloadCurrentView()
    return
  }
  if (selection === 'profile') {
    await openProfile(post.authorHandle)
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
    profileRevision += 1
    state = restoreReaderSnapshot(state, saved)
    bodyPage = 0
    galleryImageIndex = 0
    threadReturnBodyPage = 0
    loadingProgress = null
    profileState = null
    profileBodyPage = 0
    appLayer = appLayer === 'profile' ? 'reader' : appLayer
    menuOpen = false
    menuError = null
    void render()
  },
)

for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-action]')) {
  button.addEventListener('click', () => void handleAction(button.dataset.action as ReaderCommand))
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
  profileRevision += 1
  state = initialReaderState()
  appLayer = 'view-select'
  bodyPage = 0
  galleryImageIndex = 0
  threadReturnBodyPage = 0
  loadingProgress = null
  profileState = null
  profileBodyPage = 0
  menuOpen = false
  menuError = null
  void render()
})
element('forget-device')?.addEventListener('click', () => {
  clearBrowserAccessToken()
  stateRevision += 1
  profileRevision += 1
  state = { ...initialReaderState(), status: 'error', error: 'Access key required on this iPhone' }
  appLayer = 'view-select'
  bodyPage = 0
  galleryImageIndex = 0
  threadReturnBodyPage = 0
  loadingProgress = null
  profileState = null
  profileBodyPage = 0
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
  let renderedPageKind: AppLayer | 'post-image' | 'loading' | 'initial-loading' = 'view-select'
  let bridgeQueue = Promise.resolve()
  let loadingLogoDataPromise: Promise<Uint8Array> | undefined

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

  const loadingLogoContainer = () =>
    new ImageContainerProperty({
      xPosition: LOADING_LOGO_LAYOUT.x,
      yPosition: LOADING_LOGO_LAYOUT.y,
      width: LOADING_LOGO_LAYOUT.width,
      height: LOADING_LOGO_LAYOUT.height,
      containerID: LOADING_LOGO_ID,
      containerName: LOADING_LOGO_NAME,
      zOrderIndex: 1,
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
      xPosition: ACTION_MENU_BOUNDS.x,
      yPosition: ACTION_MENU_BOUNDS.y,
      width: ACTION_MENU_BOUNDS.width,
      height: ACTION_MENU_BOUNDS.height,
      borderWidth: 2,
      borderColor: 15,
      borderRadius: 6,
      paddingLength: 0,
      containerID: ACTION_MENU_ID,
      containerName: ACTION_MENU_NAME,
      isEventCapture: 1,
      zOrderIndex: 15,
      itemContainer: new ListItemContainerProperty({
        itemCount: items.length,
        itemWidth: 0,
        isItemSelectBorderEn: 1,
        itemName: items,
      }),
    })

  const actionMenuBackgrounds = () =>
    ACTION_MENU_BACKGROUND_CONFIG.map(
      (config) =>
        new ImageContainerProperty({
          xPosition: config.x,
          yPosition: config.y,
          width: config.width,
          height: config.height,
          containerID: config.containerID,
          containerName: config.containerName,
          zOrderIndex: config.zOrderIndex,
        }),
    )

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
    image: null,
  })

  const centredLoadingText = (
    containerID: number,
    containerName: string,
    yPosition: number,
    content: string,
    zOrderIndex: number,
    isEventCapture = 0,
  ) => {
    const width = Math.min(560, Math.max(20, Math.ceil(getTextWidth(content))))
    return textContainer(
      containerID,
      containerName,
      Math.floor((576 - width) / 2),
      yPosition,
      width,
      36,
      zOrderIndex,
      content,
      isEventCapture,
    )
  }

  const loadingPage = () => {
    const progress = currentLoadingProgress()
    const indicator = loadingIndicator(progress)
    const showLogo = shouldShowLoadingLogo(progress.operation)
    return {
      pageKind: showLogo ? ('initial-loading' as const) : ('loading' as const),
      textObject: [
        centredLoadingText(
          LOADING_TITLE_ID,
          LOADING_TITLE_NAME,
          showLogo ? 126 : 58,
          indicator.title,
          showLogo ? 2 : 1,
        ),
        centredLoadingText(
          LOADING_PROGRESS_ID,
          LOADING_PROGRESS_NAME,
          showLogo ? 174 : 116,
          indicator.progressLine,
          showLogo ? 3 : 2,
        ),
        centredLoadingText(
          LOADING_STATUS_ID,
          LOADING_STATUS_NAME,
          showLogo ? 222 : 172,
          indicator.label,
          showLogo ? 4 : 3,
          1,
        ),
      ],
      imageObject: showLogo ? [loadingLogoContainer()] : [],
      listObject: [],
      menuSignature: '',
      image: null,
    }
  }

  const profilePage = () => {
    const profile = profileState?.profile
    const summary = profile ? profileSummary(profile) : null
    return {
      pageKind: 'profile' as const,
      textObject: [
        textContainer(
          AUTHOR_ID,
          AUTHOR_NAME,
          72,
          AUTHOR_Y,
          492,
          58,
          2,
          summary?.author ?? `@${profileState?.handle ?? 'unknown'}`,
        ),
        textContainer(
          BODY_ID,
          BODY_NAME,
          8,
          BODY_Y,
          560,
          166,
          3,
          profileState?.status === 'error'
            ? `Unable to load this profile.\n${profileState.error ?? 'Unknown error'}`
            : (summary?.body ?? 'No bio'),
          1,
        ),
        textContainer(
          PROFILE_STATS_ID,
          PROFILE_STATS_NAME,
          8,
          244,
          560,
          36,
          5,
          summary?.stats ?? '',
        ),
      ],
      imageObject: [avatarContainer()],
      listObject: [],
      menuSignature: '',
      image: null,
    }
  }

  const readerPage = (
    sections: ReturnType<typeof renderGlassesSections>,
    reader: ReaderState,
    allowMenu: boolean,
  ) => {
    const post = reader.posts[reader.index]
    const menuItems =
      allowMenu && menuOpen && post
        ? [
            ...(menuError ? [menuError.slice(0, 64)] : []),
            ...reactionMenuItems(post).map((item) =>
              item === 'Open thread' && reader.mode === 'thread' ? 'Close thread' : item,
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
        menuItems.length > 0 ? 0 : 1,
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
        ...(menuItems.length > 0 ? actionMenuBackgrounds() : []),
      ],
      listObject: menuItems.length > 0 ? [actionMenu(menuItems)] : [],
      menuSignature: menuItems.join('\u0000'),
      image: null,
    }
  }

  const postImagePage = (sections: ReturnType<typeof renderGlassesSections>) => ({
    pageKind: 'post-image' as const,
    textObject: [
      textContainer(POST_IMAGE_INPUT_ID, POST_IMAGE_INPUT_NAME, 0, 0, 576, 288, 0, ' ', 1),
      textContainer(
        POST_IMAGE_LOADING_ID,
        POST_IMAGE_LOADING_NAME,
        96,
        96,
        384,
        96,
        5,
        imageLoadingIndicator({ stage: 'requesting', target: 'Image' }).text,
      ),
    ],
    imageObject: postImageTileContainers(),
    listObject: [],
    menuSignature: '',
    image:
      sections.postImageUrl && sections.postImageKind
        ? {
            url: sections.postImageUrl,
            kind: sections.postImageKind,
            layout: 'fullscreen' as const,
            title: undefined,
            target:
              sections.postImageCount > 1 && sections.postImageIndex !== null
                ? `Image ${sections.postImageIndex + 1}/${sections.postImageCount}`
                : 'Image',
          }
        : null,
  })

  const galleryPage = (post: NonNullable<(typeof state.posts)[number]>) => {
    const image = post.images[galleryImageIndex]
    const title = galleryTitle(galleryImageIndex, post.images.length)
    return {
      pageKind: 'gallery' as const,
      textObject: [
        textContainer(POST_IMAGE_INPUT_ID, POST_IMAGE_INPUT_NAME, 0, 0, 576, 288, 0, ' ', 1),
        textContainer(
          POST_IMAGE_LOADING_ID,
          POST_IMAGE_LOADING_NAME,
          96,
          96,
          384,
          96,
          5,
          imageLoadingIndicator({
            stage: 'requesting',
            target: `Image ${galleryImageIndex + 1}/${post.images.length}`,
          }).text,
        ),
      ],
      imageObject: postImageTileContainers(),
      listObject: [],
      menuSignature: '',
      image: image
        ? {
            url: image.url,
            kind: image.kind,
            layout: 'gallery' as const,
            title,
            target: `Image ${galleryImageIndex + 1}/${post.images.length}`,
          }
        : null,
    }
  }

  const page = (sections: ReturnType<typeof renderGlassesSections>) => {
    if (appLayer === 'view-select') return selectionPage()
    if (appLayer === 'profile') {
      if (profileState?.status === 'loading') return loadingPage()
      if (profileState?.position === 'summary' || profileState?.status === 'error') {
        return profilePage()
      }
      const reader = profileReaderState()
      if (!reader) return profilePage()
      if (sections.postImageUrl) return postImagePage(sections)
      return readerPage(sections, reader, false)
    }
    if (state.status === 'loading') return loadingPage()
    const post = state.posts[state.index]
    if (appLayer === 'gallery' && post?.images.length) return galleryPage(post)
    if (sections.postImageUrl && !menuOpen) return postImagePage(sections)
    return readerPage(sections, state, true)
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

  const menuBackgroundData = (width: number, height: number): Uint8Array => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (context) {
      context.fillStyle = '#000'
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    return canvasPngBytes(canvas)
  }

  const loadingLogoData = (): Promise<Uint8Array> => {
    loadingLogoDataPromise ??= new Promise<Uint8Array>((resolve, reject) => {
      const image = new Image()
      image.decoding = 'async'
      image.addEventListener(
        'load',
        () => {
          const canvas = document.createElement('canvas')
          canvas.width = LOADING_LOGO_LAYOUT.width
          canvas.height = LOADING_LOGO_LAYOUT.height
          const context = canvas.getContext('2d')
          if (!context) {
            reject(new Error('Unable to prepare the Doge loading logo'))
            return
          }
          context.clearRect(0, 0, canvas.width, canvas.height)
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          resolve(canvasPngBytes(canvas))
        },
        { once: true },
      )
      image.addEventListener(
        'error',
        () => reject(new Error('Unable to load the Doge icon asset')),
        { once: true },
      )
      image.src = LOADING_LOGO_SOURCE
    })
    return loadingLogoDataPromise
  }

  const updateLoadingLogo = async (): Promise<void> => {
    const result = await bridge.updateImageRawData(
      new ImageRawDataUpdate({
        containerID: LOADING_LOGO_ID,
        containerName: LOADING_LOGO_NAME,
        imageData: await loadingLogoData(),
      }),
    )
    if (result !== ImageRawDataUpdateResult.success) {
      console.warn(`Doge loading logo update failed: ${result}`)
    }
  }

  const updateMenuBackground = async (): Promise<void> => {
    if (!menuOpen) return
    for (const [index, config] of ACTION_MENU_BACKGROUND_CONFIG.entries()) {
      const result = await bridge.updateImageRawData(
        new ImageRawDataUpdate({
          containerID: config.containerID,
          containerName: config.containerName,
          imageData: menuBackgroundData(config.width, config.height),
        }),
      )
      if (result !== ImageRawDataUpdateResult.success) {
        console.warn(`Action menu background tile ${index + 1} update failed: ${result}`)
        return
      }
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
      isCurrent: () =>
        latestRenderEpoch.isCurrent(epoch) && (appLayer === 'reader' || appLayer === 'profile'),
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

  const updateMetricStrip = async (force = false, post = activePost()): Promise<void> => {
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
    layout: PostImageLayout,
    title?: string,
    onProgress?: (stage: 'downloading' | 'processing') => Promise<void>,
  ): Promise<FullscreenImageTileData> => {
    const key = `${layout}:${kind}:${title ?? ''}:${url}`
    let pending = postImageCache.get(key)
    if (!pending) {
      pending = loadPostImage(url, async (stage) => {
        await onProgress?.(stage === 'downloading' ? 'downloading' : 'processing')
      }).then((image) => renderPostImageTiles(image, kind, layout, title))
      postImageCache.set(key, pending)
      if (postImageCache.size > 8) postImageCache.delete(postImageCache.keys().next().value ?? '')
    }
    try {
      return await pending
    } catch (error) {
      postImageCache.delete(key)
      console.warn('Unable to load post image', error)
      return renderPostImagePlaceholderTiles(kind, layout, title)
    }
  }

  const updatePostImageLoading = async (
    progress: ImageLoadingProgress | null,
  ): Promise<boolean> => {
    updatePhoneImageLoading(progress)
    const content = progress ? imageLoadingIndicator(progress).text : ''
    const previousLength = renderedLengths.get(POST_IMAGE_LOADING_ID) ?? 0
    const updated = await bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: POST_IMAGE_LOADING_ID,
        containerName: POST_IMAGE_LOADING_NAME,
        contentOffset: 0,
        contentLength: previousLength,
        content,
      }),
    )
    if (updated) renderedLengths.set(POST_IMAGE_LOADING_ID, content.length)
    return updated
  }

  const updatePostImage = async (
    url: string,
    kind: PostImageKind,
    layout: PostImageLayout,
    title?: string,
    target = 'Image',
    force = false,
    epoch?: number,
  ): Promise<void> => {
    const key = `${layout}:${kind}:${title ?? ''}:${url}`
    if (!force && renderedPostImageKey === key) return
    const isCurrent = () => epoch === undefined || latestRenderEpoch.isCurrent(epoch)
    await updatePostImageLoading({ stage: 'requesting', target })
    const tiles = await postImageData(url, kind, layout, title, async (stage) => {
      if (!isCurrent()) return
      await updatePostImageLoading({ stage, target })
    })
    if (!isCurrent()) return
    await updatePostImageLoading({ stage: 'transferring', completedTiles: 0, target })
    for (const [index, config] of POST_IMAGE_TILE_CONFIG.entries()) {
      if (!isCurrent()) return
      const result = await bridge.updateImageRawData(
        new ImageRawDataUpdate({
          containerID: config.containerID,
          containerName: config.containerName,
          imageData: tiles[config.dataIndex],
        }),
      )
      if (result !== ImageRawDataUpdateResult.success) {
        console.warn(`Post image tile ${config.dataIndex + 1} update failed: ${result}`)
        await updatePostImageLoading(null)
        return
      }
      if (!isCurrent()) return
      await updatePostImageLoading({
        stage: 'transferring',
        completedTiles: (index + 1) as 1 | 2 | 3 | 4,
        target,
      })
    }
    renderedPostImageKey = key
    await updatePostImageLoading(null)
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
    await updateMetricStrip(force, activePost())
    if (!latestRenderEpoch.isCurrent(epoch)) return
    await updateMenuBackground()
  }

  const initial = renderActiveSections()
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
  if (initialPage.pageKind === 'initial-loading') {
    await updateLoadingLogo()
  } else if (initialPage.pageKind === 'reader') {
    const epoch = latestRenderEpoch.issue()
    await refreshReaderPageImages(initial, true, epoch)
  }

  const draw = async (epoch: number): Promise<void> => {
    if (!latestRenderEpoch.isCurrent(epoch)) return
    const sections = renderActiveSections()
    const nextPage = page(sections)
    let needsRebuild =
      nextPage.pageKind !== renderedPageKind || nextPage.menuSignature !== renderedMenuSignature
    if (!needsRebuild && nextPage.pageKind !== 'post-image' && nextPage.pageKind !== 'gallery') {
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
      if (nextPage.pageKind === 'initial-loading') {
        await updateLoadingLogo()
        renderedAvatarUrl = undefined
        renderedPostImageKey = undefined
        renderedMetricSignature = ''
      } else if (nextPage.pageKind === 'reader') {
        await refreshReaderPageImages(sections, true, epoch)
        renderedPostImageKey = undefined
      } else if (nextPage.pageKind === 'profile') {
        await updateAvatar(profileState?.profile?.avatarUrl ?? null, true, epoch)
        renderedPostImageKey = undefined
        renderedMetricSignature = ''
      } else if (nextPage.image) {
        renderedAvatarUrl = undefined
        renderedMetricSignature = ''
        await updatePostImage(
          nextPage.image.url,
          nextPage.image.kind,
          nextPage.image.layout,
          nextPage.image.title,
          nextPage.image.target,
          true,
          epoch,
        )
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
      await updateMetricStrip(false, activePost())
      return
    }
    if (nextPage.pageKind === 'profile') {
      await updateAvatar(profileState?.profile?.avatarUrl ?? null, false, epoch)
      return
    }
    if (nextPage.image) {
      await updatePostImage(
        nextPage.image.url,
        nextPage.image.kind,
        nextPage.image.layout,
        nextPage.image.title,
        nextPage.image.target,
        false,
        epoch,
      )
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
        const intent = classifyInput(event)
        if (!intent) return
        if (intent.type === 'back') {
          const destination = backDestination({
            layer: appLayer,
            menuOpen,
            readerMode: state.mode,
          })
          if (destination === 'exit') {
            await bridge.shutDownPageContainer(1)
          } else if (destination === 'close-menu') {
            menuOpen = false
            menuError = null
            await render()
          } else if (destination === 'reader') {
            await returnToReader()
          } else if (destination === 'close-thread') {
            await handleAction('toggle-detail')
          } else {
            await returnToViewSelection()
          }
          return
        }
        if (intent.type === 'cleanup') {
          unsubscribe()
          return
        }
        if (intent.type === 'confirm') {
          if (appLayer === 'view-select') {
            const feed =
              intent.selectionIndex === null ? null : feedForViewIndex(intent.selectionIndex)
            if (feed) await openView(feed)
            return
          }
          if (menuOpen) {
            if (intent.selectionIndex !== null) {
              await handleMenuSelection(intent.selectionIndex)
            }
            return
          }
          await handleAction('confirm')
          return
        }
        await handleAction(intent.direction)
      })
      .catch((error: unknown) => console.error(error))
  })
  await render()
}

void startGlasses().catch((error: unknown) => {
  console.warn('Even Hub bridge is not available in this browser', error)
  void render()
})

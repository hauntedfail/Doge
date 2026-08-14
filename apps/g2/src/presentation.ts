import type { Post, PostImage, PostImageKind } from '@even-g2-x-reader/contracts'
import { loadingIndicator, type LoadingProgress } from './loading-progress.js'
import { scrollPostBody } from './post-pages.js'
import type { ReaderState } from './reader-state.js'

export interface GlassesSections {
  position: string
  author: string
  body: string
  avatarUrl: string | null
  postImageUrl: string | null
  postImageKind: PostImageKind | null
  postImageIndex: number | null
  postImageCount: number
  postImages: readonly PostImage[]
  metricCounts: {
    reply: string
    repost: string
    like: string
    view: string
    bookmark: string
  }
  bodyPage: number
  bodyPageCount: number
}

function clean(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
}

function compact(value: number | null): string {
  if (value === null) return '-'
  if (value >= 100_000_000_000) return `${Math.round(value / 1_000_000_000)}B`
  if (value >= 100_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 10_000_000) return `${Math.round(value / 1_000_000)}M`
  if (value >= 100_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return String(value)
}

function date(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.valueOf())) return ''
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed)
}

function postSections(post: Post, state: ReaderState, requestedPosition: number): GlassesSections {
  const frames = scrollPostBody(clean(post.text), post.images.length)
  const bodyPage = Math.min(Math.max(0, requestedPosition), frames.length - 1)
  const displayFrame = frames[bodyPage] ?? { body: '', showMedia: false }
  const postImage = displayFrame.showMedia ? post.images[0] : undefined
  const author =
    `${clean(post.authorName)}\n@${clean(post.authorHandle)}  ${date(post.createdAt)}`.trim()
  return {
    position: `${state.index + 1}/${state.posts.length}`,
    author,
    body: displayFrame.body,
    avatarUrl: post.authorAvatarUrl,
    postImageUrl: postImage?.url ?? null,
    postImageKind: postImage?.kind ?? null,
    postImageIndex: displayFrame.showMedia && post.images.length > 0 ? 0 : null,
    postImageCount: post.images.length,
    postImages: displayFrame.showMedia ? post.images : [],
    metricCounts: {
      reply: compact(post.replyCount),
      repost: compact(post.repostCount),
      like: compact(post.likeCount),
      view: compact(post.viewCount),
      bookmark: compact(post.bookmarkCount),
    },
    bodyPage,
    bodyPageCount: frames.length,
  }
}

export function renderGlassesSections(
  state: ReaderState,
  bodyPage = 0,
  loadingProgress?: LoadingProgress,
): GlassesSections {
  if (state.status === 'error') {
    return {
      position: '',
      author: '',
      body: `Unable to load the timeline.\n${clean(state.error ?? 'Unknown error')}`,
      avatarUrl: null,
      postImageUrl: null,
      postImageKind: null,
      postImageIndex: null,
      postImageCount: 0,
      postImages: [],
      metricCounts: { reply: '', repost: '', like: '', view: '', bookmark: '' },
      bodyPage: 0,
      bodyPageCount: 1,
    }
  }
  if (state.status === 'loading') {
    const indicator = loadingIndicator(
      loadingProgress ?? { operation: 'initial', stage: 'connecting', target: state.feed },
    )
    return {
      position: '',
      author: '',
      body: indicator.text,
      avatarUrl: null,
      postImageUrl: null,
      postImageKind: null,
      postImageIndex: null,
      postImageCount: 0,
      postImages: [],
      metricCounts: { reply: '', repost: '', like: '', view: '', bookmark: '' },
      bodyPage: 0,
      bodyPageCount: 1,
    }
  }
  const post = state.posts[state.index]
  return post
    ? postSections(post, state, bodyPage)
    : {
        position: '',
        author: '',
        body: 'No posts found.',
        avatarUrl: null,
        postImageUrl: null,
        postImageKind: null,
        postImageIndex: null,
        postImageCount: 0,
        postImages: [],
        metricCounts: { reply: '', repost: '', like: '', view: '', bookmark: '' },
        bodyPage: 0,
        bodyPageCount: 1,
      }
}

export function renderGlassesText(state: ReaderState): string {
  const sections = renderGlassesSections(state)
  return [
    sections.author,
    sections.body,
    ...Object.values(sections.metricCounts),
    sections.position,
  ]
    .filter(Boolean)
    .join('\n')
}

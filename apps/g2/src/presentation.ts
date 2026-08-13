import type { Post, PostImageKind } from '@even-g2-x-reader/contracts'
import { scrollPostBody } from './post-pages.js'
import type { ReaderState } from './reader-state.js'

export interface GlassesSections {
  position: string
  author: string
  body: string
  avatarUrl: string | null
  postImageUrl: string | null
  postImageKind: PostImageKind | null
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
  const frames = scrollPostBody(clean(post.text), post.images.length > 0)
  const bodyPage = Math.min(Math.max(0, requestedPosition), frames.length - 1)
  const displayFrame = frames[bodyPage] ?? { body: '', showsImage: false }
  const author =
    `${clean(post.authorName)}\n@${clean(post.authorHandle)}  ${date(post.createdAt)}`.trim()
  return {
    position: `${state.index + 1}/${state.posts.length}`,
    author,
    body: displayFrame.body,
    avatarUrl: post.authorAvatarUrl,
    postImageUrl: displayFrame.showsImage ? (post.images[0]?.url ?? null) : null,
    postImageKind: displayFrame.showsImage ? (post.images[0]?.kind ?? null) : null,
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

export function renderGlassesSections(state: ReaderState, bodyPage = 0): GlassesSections {
  if (state.status === 'error') {
    return {
      position: '',
      author: '',
      body: `Unable to load the timeline.\n${clean(state.error ?? 'Unknown error')}`,
      avatarUrl: null,
      postImageUrl: null,
      postImageKind: null,
      metricCounts: { reply: '', repost: '', like: '', view: '', bookmark: '' },
      bodyPage: 0,
      bodyPageCount: 1,
    }
  }
  if (state.status === 'loading' && state.posts.length === 0) {
    return {
      position: '',
      author: '',
      body: 'Loading…',
      avatarUrl: null,
      postImageUrl: null,
      postImageKind: null,
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

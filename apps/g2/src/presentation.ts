import type { Post, PostImageKind } from '@even-g2-x-reader/contracts'
import { paginatePostBody } from './post-pages.js'
import type { ReaderState } from './reader-state.js'

export interface GlassesSections {
  header: string
  author: string
  body: string
  avatarUrl: string | null
  postImageUrl: string | null
  postImageKind: PostImageKind | null
  metricCounts: {
    reply: string
    repost: string
    like: string
  }
  bodyPage: number
  bodyPageCount: number
}

function clean(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/gu, '')
}

function compact(value: number | null): string {
  if (value === null) return '-'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`
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

function postSections(post: Post, state: ReaderState, requestedPage: number): GlassesSections {
  const feed = state.mode === 'thread' ? 'THREAD' : state.feed.toUpperCase()
  const pages = paginatePostBody(clean(post.text), post.images.length > 0)
  const bodyPage = Math.min(Math.max(0, requestedPage), pages.length - 1)
  const displayPage = pages[bodyPage] ?? { body: '', showsImage: false }
  const pageMarker = pages.length > 1 ? ` · ${bodyPage + 1}/${pages.length}` : ''
  const header = `DOGE / ${feed}    ${state.index + 1}/${state.posts.length}${pageMarker}`
  const author =
    `${clean(post.authorName)}\n@${clean(post.authorHandle)}  ${date(post.createdAt)}`.trim()
  return {
    header,
    author,
    body: displayPage.body,
    avatarUrl: post.authorAvatarUrl,
    postImageUrl: displayPage.showsImage ? (post.images[0]?.url ?? null) : null,
    postImageKind: displayPage.showsImage ? (post.images[0]?.kind ?? null) : null,
    metricCounts: {
      reply: compact(post.replyCount),
      repost: compact(post.repostCount),
      like: compact(post.likeCount),
    },
    bodyPage,
    bodyPageCount: pages.length,
  }
}

export function renderGlassesSections(state: ReaderState, bodyPage = 0): GlassesSections {
  if (state.status === 'error') {
    return {
      header: `DOGE / ${state.feed.toUpperCase()}`,
      author: '',
      body: `Unable to load the timeline.\n${clean(state.error ?? 'Unknown error')}`,
      avatarUrl: null,
      postImageUrl: null,
      postImageKind: null,
      metricCounts: { reply: '', repost: '', like: '' },
      bodyPage: 0,
      bodyPageCount: 1,
    }
  }
  if (state.status === 'loading' && state.posts.length === 0) {
    return {
      header: `DOGE / ${state.feed.toUpperCase()}`,
      author: '',
      body: 'Loading…',
      avatarUrl: null,
      postImageUrl: null,
      postImageKind: null,
      metricCounts: { reply: '', repost: '', like: '' },
      bodyPage: 0,
      bodyPageCount: 1,
    }
  }
  const post = state.posts[state.index]
  return post
    ? postSections(post, state, bodyPage)
    : {
        header: `DOGE / ${state.feed.toUpperCase()}`,
        author: '',
        body: 'No posts found.',
        avatarUrl: null,
        postImageUrl: null,
        postImageKind: null,
        metricCounts: { reply: '', repost: '', like: '' },
        bodyPage: 0,
        bodyPageCount: 1,
      }
}

export function renderGlassesText(state: ReaderState): string {
  const sections = renderGlassesSections(state)
  return [sections.header, sections.author, sections.body, ...Object.values(sections.metricCounts)]
    .filter(Boolean)
    .join('\n')
}

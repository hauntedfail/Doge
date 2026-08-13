import type { Post } from '@even-g2-x-reader/contracts'
import type { ReaderState } from './reader-state.js'

const MAX_CONTENT = 1000

export interface GlassesSections {
  header: string
  author: string
  body: string
  avatarUrl: string | null
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

function trimTo(value: string, max: number): string {
  const characters = Array.from(value)
  return characters.length <= max ? value : `${characters.slice(0, Math.max(0, max - 1)).join('')}…`
}

function postSections(post: Post, state: ReaderState): GlassesSections {
  const feed = state.mode === 'thread' ? 'THREAD' : state.feed.toUpperCase()
  const header = `DOGE / ${feed}    ${state.index + 1}/${state.posts.length}`
  const author =
    `${clean(post.authorName)}\n@${clean(post.authorHandle)}  ${date(post.createdAt)}`.trim()
  const metrics = `RE ${compact(post.replyCount)}  RP ${compact(post.repostCount)}  LIKE ${compact(post.likeCount)}  VIEW ${compact(post.viewCount)}`
  const help =
    state.mode === 'thread'
      ? 'UP next  DOWN back  TAP return  DOUBLE exit'
      : 'UP next  DOWN back  TAP thread  R1 feed  DOUBLE exit'
  const fixed = `\n\n${metrics}\n${help}`
  const body = `${trimTo(clean(post.text), MAX_CONTENT - fixed.length)}\n\n${metrics}\n${help}`
  return { header, author, body, avatarUrl: post.authorAvatarUrl }
}

export function renderGlassesSections(state: ReaderState): GlassesSections {
  if (state.status === 'error') {
    return {
      header: `DOGE / ${state.feed.toUpperCase()}`,
      author: '',
      body: `Unable to load the timeline.\n${clean(state.error ?? 'Unknown error')}\n\nTAP retry  R1 switch feed  DOUBLE exit`,
      avatarUrl: null,
    }
  }
  if (state.status === 'loading' && state.posts.length === 0) {
    return {
      header: `DOGE / ${state.feed.toUpperCase()}`,
      author: '',
      body: 'Loading…\n\nR1 switch feed  DOUBLE exit',
      avatarUrl: null,
    }
  }
  const post = state.posts[state.index]
  return post
    ? postSections(post, state)
    : {
        header: `DOGE / ${state.feed.toUpperCase()}`,
        author: '',
        body: 'No posts found.\n\nR1 switch feed  DOUBLE exit',
        avatarUrl: null,
      }
}

export function renderGlassesText(state: ReaderState): string {
  const sections = renderGlassesSections(state)
  return trimTo(
    [sections.header, sections.author, sections.body].filter(Boolean).join('\n'),
    MAX_CONTENT,
  )
}

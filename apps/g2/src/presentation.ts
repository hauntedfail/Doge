import type { Post } from '@even-g2-x-reader/contracts'
import type { ReaderState } from './reader-state.js'

const MAX_CONTENT = 1000

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

function postText(post: Post, state: ReaderState): string {
  const feed = state.mode === 'thread' ? 'THREAD' : state.feed.toUpperCase()
  const header = `X / ${feed}    ${state.index + 1}/${state.posts.length}`
  const author =
    `${clean(post.authorName)}  @${clean(post.authorHandle)}  ${date(post.createdAt)}`.trim()
  const metrics = `RE ${compact(post.replyCount)}  RP ${compact(post.repostCount)}  LIKE ${compact(post.likeCount)}  VIEW ${compact(post.viewCount)}`
  const help =
    state.mode === 'thread'
      ? 'UP next  DOWN back  TAP return  DOUBLE exit'
      : 'UP next  DOWN back  TAP thread  R1 feed  DOUBLE exit'
  const fixed = `${header}\n${author}\n\n\n${metrics}\n${help}`
  return `${header}\n${author}\n\n${trimTo(clean(post.text), MAX_CONTENT - fixed.length)}\n\n${metrics}\n${help}`
}

export function renderGlassesText(state: ReaderState): string {
  let output: string
  if (state.status === 'error') {
    output = `X / ${state.feed.toUpperCase()}\n\nUnable to load the timeline.\n${clean(state.error ?? 'Unknown error')}\n\nTAP retry  R1 switch feed  DOUBLE exit`
  } else if (state.status === 'loading' && state.posts.length === 0) {
    output = `X / ${state.feed.toUpperCase()}\n\nLoading…\n\nR1 switch feed  DOUBLE exit`
  } else {
    const post = state.posts[state.index]
    output = post
      ? postText(post, state)
      : `X / ${state.feed.toUpperCase()}\n\nNo posts found.\n\nR1 switch feed  DOUBLE exit`
  }
  return trimTo(output, MAX_CONTENT)
}

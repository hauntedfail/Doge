import {
  feedSchema,
  postSchema,
  type Feed,
  type Post,
  type Reaction,
} from '@even-g2-x-reader/contracts'
import { z } from 'zod'

export type ReaderMode = 'timeline' | 'thread'
export type ReaderStatus = 'loading' | 'ready' | 'error'

interface ReturnContext {
  posts: Post[]
  index: number
  nextCursor: string | null
}

export interface ReaderState {
  feed: Feed
  posts: Post[]
  index: number
  nextCursor: string | null
  mode: ReaderMode
  status: ReaderStatus
  error: string | null
  returnTo: ReturnContext | null
}

export type ReaderAction =
  | { type: 'timeline-loading' }
  | { type: 'timeline-loaded'; posts: Post[]; nextCursor: string | null }
  | { type: 'timeline-appended'; posts: Post[]; nextCursor: string | null }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'cycle-feed' }
  | { type: 'thread-loaded'; posts: Post[] }
  | { type: 'close-thread' }
  | { type: 'reaction-updated'; postId: string; reaction: Reaction; active: boolean }
  | { type: 'error'; message: string }

const returnContextSchema = z.object({
  posts: z.array(postSchema),
  index: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
})
const snapshotSchema = z.object({
  feed: feedSchema,
  posts: z.array(postSchema),
  index: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  mode: z.enum(['timeline', 'thread']),
  status: z.enum(['loading', 'ready', 'error']).optional(),
  error: z.string().nullable().optional(),
  returnTo: returnContextSchema.nullable().optional(),
})

export function initialReaderState(): ReaderState {
  return {
    feed: 'home',
    posts: [],
    index: 0,
    nextCursor: null,
    mode: 'timeline',
    status: 'loading',
    error: null,
    returnTo: null,
  }
}

function clampIndex(index: number, posts: Post[]): number {
  return Math.min(index, Math.max(0, posts.length - 1))
}

function updatePostReaction(post: Post, postId: string, reaction: Reaction, active: boolean): Post {
  if (post.id !== postId) return post
  const stateKey =
    reaction === 'like'
      ? 'viewerHasLiked'
      : reaction === 'repost'
        ? 'viewerHasReposted'
        : 'viewerHasBookmarked'
  const wasActive = post[stateKey]
  if (wasActive === active) return post
  if (reaction === 'like') {
    return {
      ...post,
      viewerHasLiked: active,
      likeCount: Math.max(0, post.likeCount + (active ? 1 : -1)),
    }
  }
  if (reaction === 'repost') {
    return {
      ...post,
      viewerHasReposted: active,
      repostCount: Math.max(0, post.repostCount + (active ? 1 : -1)),
    }
  }
  return { ...post, viewerHasBookmarked: active }
}

export function reduceReaderState(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case 'timeline-loading':
      return { ...state, status: 'loading', error: null }
    case 'timeline-loaded':
      return {
        ...state,
        posts: [...action.posts],
        index: 0,
        nextCursor: action.nextCursor,
        mode: 'timeline',
        status: 'ready',
        error: null,
        returnTo: null,
      }
    case 'timeline-appended':
      return {
        ...state,
        posts: [...state.posts, ...action.posts],
        nextCursor: action.nextCursor,
        status: 'ready',
        error: null,
      }
    case 'next':
      return { ...state, index: clampIndex(state.index + 1, state.posts) }
    case 'previous':
      return { ...state, index: Math.max(0, state.index - 1) }
    case 'cycle-feed': {
      const feeds: Feed[] = ['home', 'following', 'bookmarks']
      const next = feeds[(feeds.indexOf(state.feed) + 1) % feeds.length] ?? 'home'
      return { ...initialReaderState(), feed: next }
    }
    case 'thread-loaded':
      return {
        ...state,
        returnTo:
          state.mode === 'timeline'
            ? { posts: [...state.posts], index: state.index, nextCursor: state.nextCursor }
            : state.returnTo,
        posts: [...action.posts],
        index: 0,
        nextCursor: null,
        mode: 'thread',
        status: 'ready',
        error: null,
      }
    case 'close-thread':
      if (!state.returnTo) return state
      return {
        ...state,
        ...state.returnTo,
        mode: 'timeline',
        status: 'ready',
        error: null,
        returnTo: null,
      }
    case 'reaction-updated': {
      const update = (post: Post) =>
        updatePostReaction(post, action.postId, action.reaction, action.active)
      return {
        ...state,
        posts: state.posts.map(update),
        returnTo: state.returnTo
          ? { ...state.returnTo, posts: state.returnTo.posts.map(update) }
          : null,
      }
    }
    case 'error':
      return { ...state, status: 'error', error: action.message }
  }
}

export function readerSnapshot(state: ReaderState): ReaderState {
  return {
    ...state,
    posts: state.posts.map((post) => ({ ...post })),
    returnTo: state.returnTo
      ? { ...state.returnTo, posts: state.returnTo.posts.map((post) => ({ ...post })) }
      : null,
  }
}

export function restoreReaderSnapshot(current: ReaderState, saved: unknown): ReaderState {
  const parsed = snapshotSchema.safeParse(saved)
  if (!parsed.success) return current
  return {
    feed: parsed.data.feed,
    posts: parsed.data.posts,
    index: clampIndex(parsed.data.index, parsed.data.posts),
    nextCursor: parsed.data.nextCursor,
    mode: parsed.data.mode,
    status: parsed.data.status ?? 'ready',
    error: parsed.data.error ?? null,
    returnTo: parsed.data.returnTo ?? null,
  }
}

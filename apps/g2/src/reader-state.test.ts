import { describe, expect, it } from 'vitest'
import { initialReaderState, reduceReaderState, restoreReaderSnapshot } from './reader-state.js'

const posts = ['1', '2'].map((id) => ({
  id,
  authorName: `Author ${id}`,
  authorHandle: `author${id}`,
  authorAvatarUrl: null,
  text: `Post ${id}`,
  createdAt: '2026-08-12T00:00:00.000Z',
  replyCount: 0,
  repostCount: 0,
  likeCount: 0,
  viewCount: null,
  images: [],
  viewerHasLiked: false,
  viewerHasReposted: false,
  viewerHasBookmarked: false,
}))

describe('reader state', () => {
  it('moves forward on swipe-up and back on swipe-down', () => {
    let state = reduceReaderState(initialReaderState(), {
      type: 'timeline-loaded',
      posts,
      nextCursor: null,
    })
    state = reduceReaderState(state, { type: 'next' })
    expect(state.index).toBe(1)
    state = reduceReaderState(state, { type: 'previous' })
    expect(state.index).toBe(0)
  })

  it('enters an explicitly selected view with a clean reader state', () => {
    const loaded = reduceReaderState(initialReaderState(), {
      type: 'timeline-loaded',
      posts,
      nextCursor: 'next',
    })
    const selected = reduceReaderState(loaded, { type: 'select-feed', feed: 'bookmarks' })
    expect(selected).toEqual({ ...initialReaderState(), feed: 'bookmarks' })
  })

  it('restores only validated serialisable snapshot fields', () => {
    const restored = restoreReaderSnapshot(initialReaderState(), {
      feed: 'bookmarks',
      index: 4,
      mode: 'timeline',
      posts,
      nextCursor: 'next',
    })
    expect(restored.feed).toBe('bookmarks')
    expect(restored.posts).toHaveLength(2)
    expect(restoreReaderSnapshot(restored, { feed: 'likes' }).feed).toBe('bookmarks')
  })

  it('updates reaction state and visible counts exactly once across thread copies', () => {
    let state = reduceReaderState(initialReaderState(), {
      type: 'timeline-loaded',
      posts,
      nextCursor: null,
    })
    state = reduceReaderState(state, { type: 'thread-loaded', posts: [posts[0]!] })
    state = reduceReaderState(state, {
      type: 'reaction-updated',
      postId: '1',
      reaction: 'like',
      active: true,
    })
    expect(state.posts[0]).toMatchObject({ viewerHasLiked: true, likeCount: 1 })
    expect(state.returnTo?.posts[0]).toMatchObject({ viewerHasLiked: true, likeCount: 1 })

    state = reduceReaderState(state, {
      type: 'reaction-updated',
      postId: '1',
      reaction: 'like',
      active: true,
    })
    expect(state.posts[0]?.likeCount).toBe(1)

    state = reduceReaderState(state, {
      type: 'reaction-updated',
      postId: '1',
      reaction: 'repost',
      active: true,
    })
    expect(state.posts[0]).toMatchObject({ viewerHasReposted: true, repostCount: 1 })

    state = reduceReaderState(state, {
      type: 'reaction-updated',
      postId: '1',
      reaction: 'bookmark',
      active: true,
    })
    expect(state.posts[0]).toMatchObject({ viewerHasBookmarked: true })
  })
})

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
  bookmarkCount: 0,
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

  it('orders refreshed timeline posts newest first', () => {
    const refreshed = reduceReaderState(initialReaderState(), {
      type: 'timeline-loaded',
      posts: [
        { ...posts[0]!, id: 'older', createdAt: '2026-08-12T00:00:00.000Z' },
        { ...posts[1]!, id: 'newest', createdAt: '2026-08-14T00:00:00.000Z' },
        { ...posts[0]!, id: 'middle', createdAt: '2026-08-13T00:00:00.000Z' },
      ],
      nextCursor: null,
    })
    expect(refreshed.posts.map((post) => post.id)).toEqual(['newest', 'middle', 'older'])

    const appended = reduceReaderState(refreshed, {
      type: 'timeline-appended',
      posts: [{ ...posts[0]!, id: 'latest', createdAt: '2026-08-15T00:00:00.000Z' }],
      nextCursor: null,
    })
    expect(appended.posts.map((post) => post.id)).toEqual(['latest', 'newest', 'middle', 'older'])
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
    expect(state.posts[0]).toMatchObject({ viewerHasBookmarked: true, bookmarkCount: 1 })
  })
})

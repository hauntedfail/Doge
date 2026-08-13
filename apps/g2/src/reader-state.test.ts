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

  it('cycles Home, Following, and Bookmarks from the ring', () => {
    let state = initialReaderState()
    state = reduceReaderState(state, { type: 'cycle-feed' })
    expect(state.feed).toBe('following')
    state = reduceReaderState(state, { type: 'cycle-feed' })
    expect(state.feed).toBe('bookmarks')
    state = reduceReaderState(state, { type: 'cycle-feed' })
    expect(state.feed).toBe('home')
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
})

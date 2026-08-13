import { describe, expect, it } from 'vitest'
import { initialProfileState, reduceProfileState } from './profile-state.js'

const profile = {
  id: '42',
  name: 'Ada',
  handle: 'ada',
  avatarUrl: null,
  bio: 'Computing pioneer',
  location: 'London',
  followerCount: 100,
  followingCount: 20,
  postCount: 300,
  verified: true,
}
const post = {
  id: '1',
  authorName: 'Ada',
  authorHandle: 'ada',
  authorAvatarUrl: null,
  text: 'Hello',
  createdAt: '2026-08-14T00:00:00.000Z',
  replyCount: 0,
  repostCount: 0,
  likeCount: 0,
  viewCount: 1,
  bookmarkCount: 0,
  images: [],
  viewerHasLiked: false,
  viewerHasReposted: false,
  viewerHasBookmarked: false,
}

describe('profile state', () => {
  it('opens on the summary before scrolling into posts', () => {
    const loaded = reduceProfileState(initialProfileState('ada'), {
      type: 'loaded',
      profile,
      posts: [post],
      nextCursor: 'next',
    })
    expect(loaded.position).toBe('summary')
    expect(reduceProfileState(loaded, { type: 'next' }).position).toBe(0)
  })

  it('returns from the first post to the summary on previous', () => {
    let state = reduceProfileState(initialProfileState('ada'), {
      type: 'loaded',
      profile,
      posts: [post],
      nextCursor: null,
    })
    state = reduceProfileState(state, { type: 'next' })
    expect(reduceProfileState(state, { type: 'previous' }).position).toBe('summary')
  })

  it('appends cursor pages without duplicating posts or losing position', () => {
    let state = reduceProfileState(initialProfileState('ada'), {
      type: 'loaded',
      profile,
      posts: [post],
      nextCursor: 'next',
    })
    state = reduceProfileState(state, { type: 'next' })
    state = reduceProfileState(state, {
      type: 'appended',
      profile,
      posts: [post, { ...post, id: '2', text: 'Second' }],
      nextCursor: null,
    })
    expect(state.posts.map(({ id }) => id)).toEqual(['1', '2'])
    expect(state.position).toBe(0)
    expect(reduceProfileState(state, { type: 'next' }).position).toBe(1)
  })
})

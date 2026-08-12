import { describe, expect, it } from 'vitest'
import { timelinePageSchema } from './index.js'

describe('timelinePageSchema', () => {
  it('accepts the stable public DTO', () => {
    const result = timelinePageSchema.parse({
      feed: 'home',
      posts: [
        {
          id: '1',
          authorName: 'Ada',
          authorHandle: 'ada',
          text: 'Hello',
          createdAt: '2026-08-12T00:00:00.000Z',
          replyCount: 0,
          repostCount: 1,
          likeCount: 2,
          viewCount: null,
        },
      ],
      nextCursor: null,
    })

    expect(result.posts[0]?.authorHandle).toBe('ada')
  })

  it('rejects write-like feed names and negative counts', () => {
    expect(() =>
      timelinePageSchema.parse({
        feed: 'likes',
        posts: [],
        nextCursor: null,
      }),
    ).toThrow()

    expect(() =>
      timelinePageSchema.parse({
        feed: 'home',
        posts: [
          {
            id: '1',
            authorName: 'A',
            authorHandle: 'a',
            text: '',
            createdAt: '',
            replyCount: -1,
            repostCount: 0,
            likeCount: 0,
            viewCount: null,
          },
        ],
        nextCursor: null,
      }),
    ).toThrow()
  })
})

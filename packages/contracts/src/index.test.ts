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
          authorAvatarUrl: 'https://pbs.twimg.com/profile_images/1/ada_normal.jpg',
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
    expect(result.posts[0]?.images).toEqual([])
  })

  it('accepts bounded post image metadata', () => {
    const result = timelinePageSchema.parse({
      feed: 'home',
      posts: [
        {
          id: '1',
          authorName: 'Ada',
          authorHandle: 'ada',
          authorAvatarUrl: null,
          text: 'Photo',
          createdAt: '2026-08-12T00:00:00.000Z',
          replyCount: 0,
          repostCount: 0,
          likeCount: 0,
          viewCount: null,
          images: [
            {
              url: 'https://pbs.twimg.com/media/Example?format=jpg&name=small',
              width: 1200,
              height: 800,
            },
          ],
        },
      ],
      nextCursor: null,
    })

    expect(result.posts[0]?.images[0]).toMatchObject({ width: 1200, height: 800 })
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
            authorAvatarUrl: null,
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

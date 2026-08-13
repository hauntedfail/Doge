import { describe, expect, it } from 'vitest'
import { profilePageSchema, reactionResultSchema, timelinePageSchema } from './index.js'

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
    expect(result.posts[0]).toMatchObject({
      bookmarkCount: null,
      viewerHasLiked: false,
      viewerHasReposted: false,
      viewerHasBookmarked: false,
    })
  })

  it('validates the bounded reaction response DTO', () => {
    expect(
      reactionResultSchema.parse({ postId: '42', reaction: 'bookmark', active: true }),
    ).toEqual({ postId: '42', reaction: 'bookmark', active: true })
    expect(() =>
      reactionResultSchema.parse({ postId: '42', reaction: 'follow', active: true }),
    ).toThrow()
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

    expect(result.posts[0]?.images[0]).toMatchObject({
      kind: 'photo',
      width: 1200,
      height: 800,
    })
  })

  it('accepts a video poster without exposing video data', () => {
    const result = timelinePageSchema.parse({
      feed: 'home',
      posts: [
        {
          id: '1',
          authorName: 'Ada',
          authorHandle: 'ada',
          authorAvatarUrl: null,
          text: 'Video',
          createdAt: '2026-08-12T00:00:00.000Z',
          replyCount: 0,
          repostCount: 0,
          likeCount: 0,
          viewCount: null,
          images: [
            {
              kind: 'video_thumbnail',
              url: 'https://pbs.twimg.com/ext_tw_video_thumb/42/pu/img/Poster_1.jpg',
              width: 1920,
              height: 1080,
            },
          ],
        },
      ],
      nextCursor: null,
    })

    expect(result.posts[0]?.images[0]?.kind).toBe('video_thumbnail')
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

  it('accepts a bounded profile page without exposing header images', () => {
    const result = profilePageSchema.parse({
      profile: {
        id: '42',
        name: 'Ada',
        handle: 'ada',
        avatarUrl: 'https://pbs.twimg.com/profile_images/42/ada_normal.jpg',
        bio: 'Computing pioneer',
        location: 'London',
        followerCount: 100,
        followingCount: 20,
        postCount: 300,
        verified: true,
        headerImageUrl: 'https://pbs.twimg.com/profile_banners/42/header.jpg',
      },
      posts: [],
      nextCursor: null,
    })

    expect(result.profile).toMatchObject({ handle: 'ada', followerCount: 100 })
    expect(result.profile).not.toHaveProperty('headerImageUrl')
  })
})

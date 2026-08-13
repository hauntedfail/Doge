import { describe, expect, it } from 'vitest'
import { parseThread, parseTimeline } from './x-parser.js'

const raw = {
  data: {
    home: {
      timeline: {
        instructions: [
          {
            entries: [
              {
                entryId: 'tweet-42',
                content: {
                  itemContent: {
                    tweet_results: {
                      result: {
                        __typename: 'TweetWithVisibilityResults',
                        tweet: {
                          __typename: 'Tweet',
                          rest_id: '42',
                          core: {
                            user_results: {
                              result: {
                                avatar: {
                                  image_url:
                                    'https://pbs.twimg.com/profile_images/42/ada_normal.jpg',
                                },
                                legacy: { name: 'Ada Lovelace', screen_name: 'ada' },
                              },
                            },
                          },
                          legacy: {
                            full_text: 'short text',
                            created_at: 'Wed Aug 12 00:00:00 +0000 2026',
                            reply_count: 3,
                            retweet_count: 5,
                            favorite_count: 8,
                            favorited: true,
                            retweeted: true,
                            bookmarked: true,
                            extended_entities: {
                              media: [
                                {
                                  type: 'photo',
                                  media_url_https:
                                    'https://pbs.twimg.com/media/Example123?format=jpg&name=large',
                                  original_info: { width: 1200, height: 800 },
                                },
                              ],
                            },
                          },
                          note_tweet: {
                            note_tweet_results: { result: { text: 'long-form text wins' } },
                          },
                          views: { count: '13' },
                          quoted_status_result: {
                            result: {
                              rest_id: '99',
                              core: {
                                user_results: {
                                  result: {
                                    avatar: {
                                      image_url:
                                        'https://pbs.twimg.com/profile_images/99/quoted_normal.jpg',
                                    },
                                    legacy: { name: 'Quoted', screen_name: 'quoted' },
                                  },
                                },
                              },
                              legacy: {
                                full_text: 'quoted post must not become a separate timeline entry',
                                created_at: 'Wed Aug 12 00:01:00 +0000 2026',
                                reply_count: 0,
                                retweet_count: 0,
                                favorite_count: 0,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              {
                entryId: 'cursor-bottom',
                content: { cursorType: 'Bottom', value: 'next-page' },
              },
            ],
          },
        ],
      },
    },
  },
}

describe('parseTimeline', () => {
  it('unwraps visibility results, prefers note text, and finds the bottom cursor', () => {
    expect(parseTimeline(raw, 'home')).toEqual({
      feed: 'home',
      posts: [
        {
          id: '42',
          authorName: 'Ada Lovelace',
          authorHandle: 'ada',
          authorAvatarUrl: 'https://pbs.twimg.com/profile_images/42/ada_normal.jpg',
          text: 'long-form text wins',
          createdAt: '2026-08-12T00:00:00.000Z',
          replyCount: 3,
          repostCount: 5,
          likeCount: 8,
          viewCount: 13,
          viewerHasLiked: true,
          viewerHasReposted: true,
          viewerHasBookmarked: true,
          images: [
            {
              kind: 'photo',
              url: 'https://pbs.twimg.com/media/Example123?format=jpg&name=small',
              width: 1200,
              height: 800,
            },
          ],
        },
      ],
      nextCursor: 'next-page',
    })
  })

  it('rejects GraphQL errors even when HTTP succeeded', () => {
    expect(() => parseTimeline({ errors: [{ message: 'not authorised' }] }, 'home')).toThrow(
      'not authorised',
    )
  })

  it('reads author identity from the current X user core shape', () => {
    const current = structuredClone(raw)
    const result =
      current.data.home.timeline.instructions[0]?.entries[0]?.content?.itemContent?.tweet_results
        ?.result
    const user = result?.tweet.core.user_results.result as
      | {
          core?: { name: string; screen_name: string }
          legacy?: { name?: string; screen_name?: string }
        }
      | undefined
    if (!user) throw new Error('test fixture is missing its author')
    user.core = { name: 'Current Name', screen_name: 'current_handle' }
    user.legacy = {}

    expect(parseTimeline(current, 'home').posts[0]).toMatchObject({
      authorName: 'Current Name',
      authorHandle: 'current_handle',
      authorAvatarUrl: 'https://pbs.twimg.com/profile_images/42/ada_normal.jpg',
    })
  })

  it('drops avatar URLs outside the fixed Twitter image origin', () => {
    const unsafe = structuredClone(raw)
    const user = unsafe.data.home.timeline.instructions[0]?.entries[0]?.content?.itemContent
      ?.tweet_results?.result?.tweet.core.user_results.result as
      { avatar?: { image_url?: string } } | undefined
    if (!user?.avatar) throw new Error('test fixture is missing its avatar')
    user.avatar.image_url = 'http://127.0.0.1:6900/health'

    expect(parseTimeline(unsafe, 'home').posts[0]?.authorAvatarUrl).toBeNull()
  })

  it('drops post media URLs outside the fixed Twitter image origin', () => {
    const unsafe = structuredClone(raw)
    const media =
      unsafe.data.home.timeline.instructions[0]?.entries[0]?.content?.itemContent?.tweet_results
        ?.result?.tweet.legacy.extended_entities.media[0]
    if (!media) throw new Error('test fixture is missing its media')
    media.media_url_https = 'http://127.0.0.1:6900/health'

    expect(parseTimeline(unsafe, 'home').posts[0]?.images).toEqual([])
  })

  it('removes only the t.co token that belongs to rendered post media', () => {
    const withLinks = structuredClone(raw)
    const tweet =
      withLinks.data.home.timeline.instructions[0]?.entries[0]?.content?.itemContent?.tweet_results
        ?.result?.tweet
    if (!tweet) throw new Error('test fixture is missing its tweet')
    delete (tweet as { note_tweet?: unknown }).note_tweet
    tweet.legacy.full_text = 'Keep https://example.com/read and render https://t.co/mediaToken'
    const media = tweet.legacy.extended_entities.media[0] as
      { url?: string; media_url_https: string } | undefined
    if (!media) throw new Error('test fixture is missing its media')
    media.url = 'https://t.co/mediaToken'

    expect(parseTimeline(withLinks, 'home').posts[0]?.text).toBe(
      'Keep https://example.com/read and render',
    )
  })

  it('extracts video and animated GIF poster images without video variants', () => {
    const motion = structuredClone(raw)
    const media =
      motion.data.home.timeline.instructions[0]?.entries[0]?.content?.itemContent?.tweet_results
        ?.result?.tweet.legacy.extended_entities.media
    if (!media) throw new Error('test fixture is missing its media')
    media.splice(
      0,
      media.length,
      {
        type: 'video',
        media_url_https: 'https://pbs.twimg.com/amplify_video_thumb/123456789/img/Video_Poster.jpg',
        original_info: { width: 1920, height: 1080 },
      },
      {
        type: 'animated_gif',
        media_url_https: 'https://pbs.twimg.com/tweet_video_thumb/GifPoster_1.jpg',
        original_info: { width: 640, height: 360 },
      },
    )

    expect(parseTimeline(motion, 'home').posts[0]?.images).toEqual([
      {
        kind: 'video_thumbnail',
        url: 'https://pbs.twimg.com/amplify_video_thumb/123456789/img/Video_Poster.jpg',
        width: 1920,
        height: 1080,
      },
      {
        kind: 'animated_gif_thumbnail',
        url: 'https://pbs.twimg.com/tweet_video_thumb/GifPoster_1.jpg',
        width: 640,
        height: 360,
      },
    ])
  })
})

describe('parseThread', () => {
  it('deduplicates recursively discovered tweets', () => {
    const repeated = { wrapper: [raw, raw] }
    expect(parseThread(repeated, '42').posts).toHaveLength(1)
  })
})

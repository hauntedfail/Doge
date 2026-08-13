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
                            extended_entities: {
                              media: [
                                {
                                  type: 'photo',
                                  media_url_https:
                                    'https://pbs.twimg.com/media/Example123?format=jpg&name=large',
                                  original_info: { width: 1200, height: 800 },
                                },
                                {
                                  type: 'video',
                                  media_url_https:
                                    'https://pbs.twimg.com/media/Video123?format=jpg&name=large',
                                  original_info: { width: 1920, height: 1080 },
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
          images: [
            {
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
})

describe('parseThread', () => {
  it('deduplicates recursively discovered tweets', () => {
    const repeated = { wrapper: [raw, raw] }
    expect(parseThread(repeated, '42').posts).toHaveLength(1)
  })
})

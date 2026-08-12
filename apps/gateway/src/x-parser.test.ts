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
                              result: { legacy: { name: 'Ada Lovelace', screen_name: 'ada' } },
                            },
                          },
                          legacy: {
                            full_text: 'short text',
                            created_at: 'Wed Aug 12 00:00:00 +0000 2026',
                            reply_count: 3,
                            retweet_count: 5,
                            favorite_count: 8,
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
                                  result: { legacy: { name: 'Quoted', screen_name: 'quoted' } },
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
          text: 'long-form text wins',
          createdAt: '2026-08-12T00:00:00.000Z',
          replyCount: 3,
          repostCount: 5,
          likeCount: 8,
          viewCount: 13,
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
})

describe('parseThread', () => {
  it('deduplicates recursively discovered tweets', () => {
    const repeated = { wrapper: [raw, raw] }
    expect(parseThread(repeated, '42').posts).toHaveLength(1)
  })
})

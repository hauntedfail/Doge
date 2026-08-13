import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadRelayCatalog } from './relay-catalog.js'
import { RelayTimelineSource } from './relay-source.js'

const temporaryPaths: string[] = []

async function catalogPath(pathForTweetDetail = '/graphql/query/TweetDetail'): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'g2-x-reader-catalog-'))
  temporaryPaths.push(directory)
  const entries = [
    { method: 'POST', path: '/graphql/query/HomeTimeline', headers: {}, data: { variables: {} } },
    {
      method: 'POST',
      path: '/graphql/query/HomeLatestTimeline',
      headers: {},
      data: { variables: {} },
    },
    { method: 'GET', path: '/graphql/query/Bookmarks', headers: {}, params: { variables: '{}' } },
    { method: 'GET', path: pathForTweetDetail, headers: {}, params: { variables: '{}' } },
    {
      method: 'GET',
      path: '/graphql/query/UserByScreenName',
      headers: {},
      params: { variables: '{"screen_name":"sample"}' },
    },
    {
      method: 'GET',
      path: '/graphql/query/UserTweets',
      headers: {},
      params: { variables: '{"userId":"1"}' },
    },
    { method: 'POST', path: '/graphql/query/FavoriteTweet', headers: {}, data: { variables: {} } },
    {
      method: 'POST',
      path: '/graphql/query/UnfavoriteTweet',
      headers: {},
      data: { variables: {} },
    },
    { method: 'POST', path: '/graphql/query/CreateRetweet', headers: {}, data: { variables: {} } },
    { method: 'POST', path: '/graphql/query/DeleteRetweet', headers: {}, data: { variables: {} } },
    {
      method: 'POST',
      path: '/graphql/query/CreateBookmark',
      headers: {},
      data: { variables: {} },
    },
    {
      method: 'POST',
      path: '/graphql/query/DeleteBookmark',
      headers: {},
      data: { variables: {} },
    },
    { method: 'POST', path: '/graphql/query/CreateTweet', headers: {}, data: { variables: {} } },
  ]
  const path = join(directory, 'requests.ndjson')
  await writeFile(path, `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`)
  return path
}

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(
    temporaryPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  )
})

describe('relay security boundary', () => {
  it('selects only the approved read and scoped reaction operations from the catalog', async () => {
    const catalog = await loadRelayCatalog(await catalogPath())
    expect([...catalog.keys()]).toEqual([
      'HomeTimeline',
      'HomeLatestTimeline',
      'Bookmarks',
      'TweetDetail',
      'UserByScreenName',
      'UserTweets',
      'FavoriteTweet',
      'UnfavoriteTweet',
      'CreateRetweet',
      'DeleteRetweet',
      'CreateBookmark',
      'DeleteBookmark',
    ])
  })

  it.each([
    ['like', true, 'FavoriteTweet', { tweet_id: '42' }],
    ['like', false, 'UnfavoriteTweet', { tweet_id: '42' }],
    ['repost', true, 'CreateRetweet', { tweet_id: '42', dark_request: false }],
    ['repost', false, 'DeleteRetweet', { source_tweet_id: '42', dark_request: false }],
    ['bookmark', true, 'CreateBookmark', { tweet_id: '42' }],
    ['bookmark', false, 'DeleteBookmark', { tweet_id: '42' }],
  ] as const)(
    'maps %s active=%s to %s with a minimal payload',
    async (reaction, active, operation, variables) => {
      const requests: Array<{ url: URL; init: RequestInit }> = []
      vi.stubGlobal(
        'fetch',
        vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
          requests.push({ url: new URL(String(input)), init })
          return new Response(JSON.stringify({ data: {} }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        }),
      )
      const source = new RelayTimelineSource('http://127.0.0.1:6900', await catalogPath())

      await expect(source.setReaction('42', reaction, active)).resolves.toEqual({
        postId: '42',
        reaction,
        active,
      })
      expect(requests).toHaveLength(1)
      expect(requests[0]?.url.pathname).toBe(`/i/api/graphql/query/${operation}`)
      expect(JSON.parse(String(requests[0]?.init.body)).variables).toEqual(variables)
    },
  )

  it('rejects an HTTP-200 GraphQL mutation error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ errors: [{ message: 'not authorised' }] }), {
            status: 200,
          }),
      ),
    )
    const source = new RelayTimelineSource('http://127.0.0.1:6900', await catalogPath())
    await expect(source.setReaction('42', 'like', true)).rejects.toThrow('not authorised')
  })

  it('rejects a traversal-shaped operation path', async () => {
    await expect(
      loadRelayCatalog(await catalogPath('/graphql/query/../TweetDetail')),
    ).rejects.toThrow('unsafe path')
  })

  it('rejects non-loopback relay origins', () => {
    expect(() => new RelayTimelineSource('https://relay.example.com', '/tmp/catalog')).toThrow(
      'loopback',
    )
    expect(() => new RelayTimelineSource('http://127.0.0.1:3000', '/tmp/catalog')).not.toThrow()
  })

  it('builds only catalog-backed read requests and replaces sample variables', async () => {
    const requests: Array<{ url: URL; init: RequestInit }> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
        requests.push({ url: new URL(String(input)), init })
        return new Response(JSON.stringify({ data: {} }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )
    const source = new RelayTimelineSource('http://127.0.0.1:6900', await catalogPath())

    await source.list('home')
    await source.thread('42')

    expect(requests[0]?.url.pathname).toBe('/i/api/graphql/query/HomeTimeline')
    expect(requests[0]?.init.method).toBe('POST')
    const homeBody = JSON.parse(String(requests[0]?.init.body))
    expect(homeBody.variables).toMatchObject({
      count: 20,
      includePromotedContent: false,
      seenTweetIds: [],
    })
    expect(homeBody.variables).not.toHaveProperty('cursor')

    expect(requests[1]?.url.pathname).toBe('/i/api/graphql/query/TweetDetail')
    expect(requests[1]?.init.method).toBe('GET')
    expect(JSON.parse(requests[1]?.url.searchParams.get('variables') ?? '{}')).toMatchObject({
      focalTweetId: '42',
      count: 20,
      includePromotedContent: false,
    })
  })

  it('resolves a handle before requesting its cursor-paginated profile timeline', async () => {
    const requests: URL[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input))
        requests.push(url)
        const body = url.pathname.endsWith('/UserByScreenName')
          ? {
              data: {
                user: {
                  result: {
                    rest_id: '42',
                    core: { name: 'Ada', screen_name: 'ada' },
                    legacy: {
                      description: '',
                      location: '',
                      followers_count: 1,
                      friends_count: 2,
                      statuses_count: 3,
                    },
                  },
                },
              },
            }
          : { data: { user: { result: { timeline: { instructions: [] } } } } }
        return Response.json(body)
      }),
    )
    const source = new RelayTimelineSource('http://127.0.0.1:6900', await catalogPath())

    const page = await source.profile('ada', 'profile-cursor')

    expect(page.profile).toMatchObject({ id: '42', handle: 'ada' })
    expect(requests.map((url) => url.pathname)).toEqual([
      '/i/api/graphql/query/UserByScreenName',
      '/i/api/graphql/query/UserTweets',
    ])
    expect(JSON.parse(requests[0]?.searchParams.get('variables') ?? '{}')).toMatchObject({
      screen_name: 'ada',
    })
    expect(JSON.parse(requests[1]?.searchParams.get('variables') ?? '{}')).toMatchObject({
      userId: '42',
      cursor: 'profile-cursor',
      count: 20,
      includePromotedContent: false,
    })
  })
})

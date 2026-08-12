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
  it('selects only the four approved read operations from the catalog', async () => {
    const catalog = await loadRelayCatalog(await catalogPath())
    expect([...catalog.keys()]).toEqual([
      'HomeTimeline',
      'HomeLatestTimeline',
      'Bookmarks',
      'TweetDetail',
    ])
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
})

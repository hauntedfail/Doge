import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  configureApi,
  loadPostImage,
  loadProfile,
  loadTimeline,
  verifyGatewayConnection,
  type DataLoadStage,
} from './api.js'

const storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

describe('API loading progress', () => {
  const configuredGateway = {
    gatewayUrl: 'https://doge.example',
    accessToken: 'A'.repeat(43),
  }

  afterEach(() => {
    configureApi(null)
    vi.unstubAllGlobals()
  })

  it('verifies a configured gateway without fetching an X timeline', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ ok: true, protocol: 'doge-gateway', apiVersion: 1 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      verifyGatewayConnection({
        gatewayUrl: 'https://doge.example',
        accessToken: 'A'.repeat(43),
      }),
    ).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://doge.example/api/v1/session',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: `Bearer ${'A'.repeat(43)}` }),
      }),
    )
  })

  it('rejects an unrelated server even when the session URL returns HTTP 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ ok: true })),
    )

    await expect(verifyGatewayConnection(configuredGateway)).resolves.toBe(false)
  })

  it('does not resurrect a browser token when runtime settings explicitly have no key', async () => {
    const legacyToken = 'B'.repeat(43)
    vi.stubGlobal('window', {
      location: { hash: '', port: '5173', origin: 'http://127.0.0.1:5173' },
      localStorage: { ...storage, getItem: () => legacyToken },
      sessionStorage: storage,
    })
    const fetchMock = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) =>
      Response.json({ feed: 'home', posts: [], nextCursor: null }),
    )
    vi.stubGlobal('fetch', fetchMock)
    configureApi({ gatewayUrl: 'https://doge.example', accessToken: null })

    await loadTimeline('home')

    const headers = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)
    expect(headers.has('authorization')).toBe(false)
  })

  it('reports response and preparation milestones in order', async () => {
    vi.stubGlobal('window', {
      location: { hash: '', port: '5173', origin: 'http://127.0.0.1:5173' },
      localStorage: storage,
      sessionStorage: storage,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          feed: 'home',
          posts: [],
          nextCursor: null,
        }),
      ),
    )
    configureApi(configuredGateway)
    const stages: DataLoadStage[] = []

    const page = await loadTimeline('home', undefined, (stage) => {
      stages.push(stage)
    })

    expect(page.feed).toBe('home')
    expect(stages).toEqual(['downloading', 'preparing'])
  })

  it('sends only explicitly viewed post IDs with a timeline request', async () => {
    vi.stubGlobal('window', {
      location: { hash: '', port: '5173', origin: 'http://127.0.0.1:5173' },
      localStorage: storage,
      sessionStorage: storage,
    })
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      Response.json({ feed: 'home', posts: [], nextCursor: null }),
    )
    vi.stubGlobal('fetch', fetchMock)
    configureApi(configuredGateway)

    await loadTimeline('home', undefined, undefined, ['11', '22'])

    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('seen=11%2C22')
  })

  it('reports image response and body download milestones', async () => {
    vi.stubGlobal('window', {
      location: { hash: '', port: '5173', origin: 'http://127.0.0.1:5173' },
      localStorage: storage,
      sessionStorage: storage,
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Blob(['image']))),
    )
    configureApi(configuredGateway)
    const stages: string[] = []

    const image = await loadPostImage('https://pbs.twimg.com/media/example.jpg', (stage) => {
      stages.push(stage)
    })

    expect(image.size).toBe(5)
    expect(stages).toEqual(['downloading', 'downloaded'])
  })

  it('loads a validated cursor-paginated profile page', async () => {
    vi.stubGlobal('window', {
      location: { hash: '', port: '5173', origin: 'http://127.0.0.1:5173' },
      localStorage: storage,
      sessionStorage: storage,
    })
    const fetchMock = vi.fn(async (_input: string | URL | Request) =>
      Response.json({
        profile: {
          id: '42',
          name: 'Ada',
          handle: 'ada',
          avatarUrl: null,
          bio: '',
          location: '',
          followerCount: 1,
          followingCount: 2,
          postCount: 3,
          verified: false,
        },
        posts: [],
        nextCursor: null,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    configureApi(configuredGateway)

    const page = await loadProfile('ada', 'next-page')

    expect(page.profile.handle).toBe('ada')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/v1/users/ada/profile?cursor=next-page',
    )
    await expect(loadProfile('not-valid!')).rejects.toThrow('Invalid X handle')
  })

  it('does not send requests until a gateway has been paired', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    configureApi(null)

    await expect(loadTimeline('home')).rejects.toThrow('Configure Gateway')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

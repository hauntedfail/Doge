import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPostImage, loadProfile, loadTimeline, type DataLoadStage } from './api.js'

const storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

describe('API loading progress', () => {
  afterEach(() => vi.unstubAllGlobals())

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

    const page = await loadProfile('ada', 'next-page')

    expect(page.profile.handle).toBe('ada')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/api/v1/users/ada/profile?cursor=next-page',
    )
    await expect(loadProfile('not-valid!')).rejects.toThrow('Invalid X handle')
  })
})

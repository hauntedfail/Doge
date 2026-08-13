import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadPostImage, loadTimeline, type DataLoadStage } from './api.js'

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
})

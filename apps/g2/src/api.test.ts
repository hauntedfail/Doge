import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTimeline, type DataLoadStage } from './api.js'

const storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

describe('timeline loading progress', () => {
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
})

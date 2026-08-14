import { describe, expect, it, vi } from 'vitest'
import { LruPromiseCache } from './image-cache.js'

describe('image LRU cache', () => {
  it('reuses a resolved image without invoking its loader again', async () => {
    const cache = new LruPromiseCache<string, Uint8Array>(2)
    const load = vi.fn(async () => new Uint8Array([1, 2, 3]))

    const first = cache.getOrLoad('image-1', load)
    const second = cache.getOrLoad('image-1', load)

    expect(first.hit).toBe(false)
    expect(second.hit).toBe(true)
    await expect(second.value).resolves.toEqual(new Uint8Array([1, 2, 3]))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('keeps recently revisited images when evicting the least-recently-used entry', () => {
    const cache = new LruPromiseCache<string, number>(2)
    cache.set('first', Promise.resolve(1))
    cache.set('second', Promise.resolve(2))
    cache.get('first')
    cache.set('third', Promise.resolve(3))

    expect(cache.has('first')).toBe(true)
    expect(cache.has('second')).toBe(false)
    expect(cache.has('third')).toBe(true)
  })
})

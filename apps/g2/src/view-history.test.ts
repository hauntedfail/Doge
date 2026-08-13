import { describe, expect, it } from 'vitest'
import { loadViewHistory, saveViewHistory } from './view-history.js'

function memoryStorage(initial: string | null = null) {
  let value = initial
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next
    },
    value: () => value,
  }
}

describe('view history persistence', () => {
  it('round-trips only the latest 200 viewed post IDs', () => {
    const storage = memoryStorage()
    const ids = Array.from({ length: 205 }, (_, index) => String(index + 1))

    saveViewHistory(storage, ids)

    expect(loadViewHistory(storage)).toEqual(ids.slice(-200))
  })

  it('ignores corrupt or invalid persisted history', () => {
    expect(loadViewHistory(memoryStorage('not-json'))).toEqual([])
    expect(loadViewHistory(memoryStorage(JSON.stringify(['1', 2])))).toEqual([])
  })
})

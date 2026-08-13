import { describe, expect, it } from 'vitest'
import { shouldReloadTimeline } from './timeline-navigation.js'

describe('timeline reload gesture', () => {
  it('reloads only when an upward slide starts at the very top of a ready timeline', () => {
    const top = { mode: 'timeline' as const, status: 'ready' as const, index: 0 }
    expect(shouldReloadTimeline('previous', top, 0)).toBe(true)
    expect(shouldReloadTimeline('next', top, 0)).toBe(false)
    expect(shouldReloadTimeline('previous', { ...top, index: 1 }, 0)).toBe(false)
    expect(shouldReloadTimeline('previous', top, 1)).toBe(false)
    expect(shouldReloadTimeline('previous', { ...top, mode: 'thread' }, 0)).toBe(false)
    expect(shouldReloadTimeline('previous', { ...top, status: 'loading' }, 0)).toBe(false)
  })
})

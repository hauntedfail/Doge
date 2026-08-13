import { describe, expect, it } from 'vitest'
import { classifyInput } from './input.js'

describe('classifyInput', () => {
  it('moves in the physical slide direction used by G2', () => {
    expect(classifyInput({ textEvent: { eventType: 1 } })).toEqual({
      type: 'swipe',
      direction: 'previous',
    })
    expect(classifyInput({ textEvent: { eventType: 2 } })).toEqual({
      type: 'swipe',
      direction: 'next',
    })
  })

  it('classifies every tap as confirm and carries native list selection', () => {
    expect(classifyInput({ sysEvent: { eventType: 0, eventSource: 2 } })).toEqual({
      type: 'confirm',
      selectionIndex: null,
    })
    expect(classifyInput({ listEvent: { currentSelectItemIndex: 4 } })).toEqual({
      type: 'confirm',
      selectionIndex: 4,
    })
    expect(classifyInput({ listEvent: {} })).toEqual({ type: 'confirm', selectionIndex: 0 })
  })

  it('classifies double tap as the shared back intent', () => {
    expect(classifyInput({ sysEvent: { eventType: 3, eventSource: 1 } })).toEqual({ type: 'back' })
  })
})

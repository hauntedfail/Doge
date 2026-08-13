import { describe, expect, it } from 'vitest'
import { classifyInput } from './input.js'

describe('classifyInput', () => {
  it('maps text swipes to feed navigation', () => {
    expect(classifyInput({ textEvent: { eventType: 1 } })).toBe('next')
    expect(classifyInput({ textEvent: { eventType: 2 } })).toBe('previous')
  })

  it('opens the action menu for a single click from either input source', () => {
    expect(classifyInput({ sysEvent: { eventType: 0, eventSource: 2 } })).toBe('open-menu')
    expect(classifyInput({ sysEvent: { eventType: 0, eventSource: 1 } })).toBe('open-menu')
  })

  it('leaves double-click routing to the application layer', () => {
    expect(classifyInput({ sysEvent: { eventType: 3, eventSource: 1 } })).toBe('double-tap')
  })
})

import { describe, expect, it } from 'vitest'
import { classifyInput } from './input.js'

describe('classifyInput', () => {
  it('maps text swipes to feed navigation', () => {
    expect(classifyInput({ textEvent: { eventType: 1 } })).toBe('next')
    expect(classifyInput({ textEvent: { eventType: 2 } })).toBe('previous')
  })

  it('uses ring click for feed switching and glasses click for detail', () => {
    expect(classifyInput({ sysEvent: { eventType: 0, eventSource: 2 } })).toBe('cycle-feed')
    expect(classifyInput({ sysEvent: { eventType: 0, eventSource: 1 } })).toBe('toggle-detail')
  })

  it('maps any double click to exit', () => {
    expect(classifyInput({ sysEvent: { eventType: 3, eventSource: 1 } })).toBe('exit')
  })
})

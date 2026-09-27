import { getTextWidth } from '@evenrealities/pretext'
import { describe, expect, it } from 'vitest'
import { footerPositionContent } from './footer-position.js'

describe('G2 reader footer position', () => {
  it('places a multi-chunk page count at the left and post count at the right', () => {
    const content = footerPositionContent('2/4', '12/30')

    expect(content.startsWith('2/4')).toBe(true)
    expect(content.endsWith('12/30')).toBe(true)
    expect(getTextWidth(content)).toBeLessThanOrEqual(560)
    expect(getTextWidth(content.slice(0, -'12/30'.length))).toBeGreaterThan(500)
  })

  it('keeps a single-chunk post count right-aligned without a left label', () => {
    const content = footerPositionContent('', '1/8')

    expect(content.trim()).toBe('1/8')
    expect(content.endsWith('1/8')).toBe(true)
    expect(getTextWidth(content)).toBeLessThanOrEqual(560)
    expect(getTextWidth(content.slice(0, -'1/8'.length))).toBeGreaterThan(500)
  })
})

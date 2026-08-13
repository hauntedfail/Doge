import { describe, expect, it } from 'vitest'
import { METRIC_FOOTER_LAYOUT, centreMetricCount } from './metric-layout.js'

describe('G2 metric footer layout', () => {
  it('centres five equal metric columns in the content area', () => {
    const first = METRIC_FOOTER_LAYOUT[0]
    const last = METRIC_FOOTER_LAYOUT.at(-1)
    if (!first || !last) throw new Error('metric footer layout is empty')

    expect(METRIC_FOOTER_LAYOUT.map((metric) => metric.kind)).toEqual([
      'reply',
      'repost',
      'like',
      'view',
      'bookmark',
    ])
    expect(METRIC_FOOTER_LAYOUT.map((metric) => metric.iconX)).toEqual([72, 139, 206, 273, 340])
    expect(first.iconX).toBe(72)
    expect(last.countX + last.countWidth).toBe(407)
    expect((first.iconX + last.countX + last.countWidth) / 2).toBeCloseTo(239.5)
  })

  it('aligns icon and count container centres vertically', () => {
    for (const metric of METRIC_FOOTER_LAYOUT) {
      expect(metric.iconY + metric.iconSize / 2).toBe(metric.countY + metric.countHeight / 2)
    }
  })

  it('centres short count text inside each fixed-width count slot', () => {
    expect(centreMetricCount('0')).toBe('\u00A0\u00A0\u00A00')
    expect(centreMetricCount('999')).toBe('\u00A0999')
  })
})

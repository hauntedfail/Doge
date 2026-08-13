import { describe, expect, it } from 'vitest'
import { METRIC_ICON_KINDS, METRIC_ICON_PATHS, METRIC_ICON_SIZE } from './metric-icons.js'

describe('G2 metric icons', () => {
  it('provides three distinct native-size X-style outlines', () => {
    expect(METRIC_ICON_SIZE).toBe(28)
    expect(METRIC_ICON_KINDS).toEqual(['reply', 'repost', 'like'])

    const paths = METRIC_ICON_KINDS.map((kind) => METRIC_ICON_PATHS[kind])
    expect(new Set(paths).size).toBe(3)
    expect(paths.every((path) => path.startsWith('M'))).toBe(true)
  })
})

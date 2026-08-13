import { describe, expect, it } from 'vitest'
import { METRIC_ICON_KINDS, METRIC_ICON_PATHS, METRIC_ICON_SIZE } from './metric-icons.js'

describe('G2 metric icons', () => {
  it('provides four distinct native-size X-style icons', () => {
    expect(METRIC_ICON_SIZE).toBe(28)
    expect(METRIC_ICON_KINDS).toEqual(['reply', 'repost', 'like', 'bookmark'])

    const paths = METRIC_ICON_KINDS.map((kind) => METRIC_ICON_PATHS[kind])
    expect(new Set(paths).size).toBe(4)
    expect(paths.every((path) => path.startsWith('M'))).toBe(true)
  })
})

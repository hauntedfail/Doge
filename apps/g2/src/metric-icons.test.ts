import { describe, expect, it, vi } from 'vitest'
import * as metricIcons from './metric-icons.js'

const { createMetricIconStripCache, METRIC_ICON_KINDS, METRIC_ICON_PATHS, METRIC_ICON_SIZE } =
  metricIcons

describe('G2 metric icons', () => {
  it('provides five distinct compact X-style icons', () => {
    expect(METRIC_ICON_SIZE).toBe(20)
    expect(METRIC_ICON_KINDS).toEqual(['reply', 'repost', 'like', 'view', 'bookmark'])

    const paths = METRIC_ICON_KINDS.map((kind) => METRIC_ICON_PATHS[kind])
    expect(new Set(paths).size).toBe(5)
    expect(paths.every((path) => path.startsWith('M'))).toBe(true)
  })

  it('places all metric icons on equal horizontal centres', () => {
    const iconX = (
      metricIcons as typeof metricIcons & {
        METRIC_ICON_X: Record<(typeof METRIC_ICON_KINDS)[number], number>
      }
    ).METRIC_ICON_X
    const centres = METRIC_ICON_KINDS.map((kind) => iconX[kind] + METRIC_ICON_SIZE / 2)

    expect(centres).toEqual([10, 77, 144, 211, 278])
  })

  it('rasterizes each viewer-reaction variant only once', () => {
    const inactive = {
      viewerHasLiked: false,
      viewerHasReposted: false,
      viewerHasBookmarked: false,
    }
    const liked = { ...inactive, viewerHasLiked: true }
    const rasterize = vi
      .fn<(state: typeof inactive) => Uint8Array>()
      .mockReturnValueOnce(new Uint8Array([1]))
      .mockReturnValueOnce(new Uint8Array([2]))
    const render = createMetricIconStripCache(rasterize)

    expect(render(inactive)).toBe(render({ ...inactive }))
    expect(render(liked)).toBe(render({ ...liked }))
    expect(rasterize).toHaveBeenCalledTimes(2)
  })
})

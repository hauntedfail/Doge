import { describe, expect, it, vi } from 'vitest'
import {
  createMetricIconStripCache,
  METRIC_ICON_KINDS,
  METRIC_ICON_PATHS,
  METRIC_ICON_SIZE,
} from './metric-icons.js'

describe('G2 metric icons', () => {
  it('provides four distinct native-size X-style icons', () => {
    expect(METRIC_ICON_SIZE).toBe(28)
    expect(METRIC_ICON_KINDS).toEqual(['reply', 'repost', 'like', 'bookmark'])

    const paths = METRIC_ICON_KINDS.map((kind) => METRIC_ICON_PATHS[kind])
    expect(new Set(paths).size).toBe(4)
    expect(paths.every((path) => path.startsWith('M'))).toBe(true)
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

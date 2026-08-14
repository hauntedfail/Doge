import { describe, expect, it } from 'vitest'
import { embeddedMediaLayout, embeddedMediaTileIndexes } from './embedded-media.js'

describe('embedded timeline media layout', () => {
  it('uses exactly two SDK-valid image containers across the reader width', () => {
    const layout = embeddedMediaLayout(1, 1)

    expect(layout.tiles).toEqual([
      { x: 8, y: 94, width: 280, height: 144 },
      { x: 288, y: 94, width: 280, height: 144 },
    ])
    expect(layout.tiles.every((tile) => tile.width <= 288 && tile.height <= 144)).toBe(true)
  })

  it('allocates more height when the post body uses fewer lines', () => {
    expect(embeddedMediaLayout(0, 2).pageKind).toBe('reader-media-empty')
    expect(embeddedMediaLayout(1, 2).height).toBe(144)
    expect(embeddedMediaLayout(2, 2).height).toBe(130)
    expect(embeddedMediaLayout(3, 2).height).toBe(104)
  })

  it('creates one distinct loading slot for every attached image', () => {
    for (const count of [1, 2, 3, 4] as const) {
      const layout = embeddedMediaLayout(1, count)
      expect(layout.slots).toHaveLength(count)
      expect(layout.slots.every((slot) => slot.width > 0 && slot.height > 0)).toBe(true)
    }
  })

  it('updates only the tile containing an image slot when possible', () => {
    const layout = embeddedMediaLayout(1, 4)

    expect(embeddedMediaTileIndexes(layout, 0)).toEqual([0])
    expect(embeddedMediaTileIndexes(layout, 1)).toEqual([0])
    expect(embeddedMediaTileIndexes(layout, 2)).toEqual([1])
    expect(embeddedMediaTileIndexes(layout, 3)).toEqual([1])
    expect(embeddedMediaTileIndexes(embeddedMediaLayout(1, 1), 0)).toEqual([0, 1])
  })
})

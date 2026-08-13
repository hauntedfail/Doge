import { describe, expect, it } from 'vitest'
import {
  FULLSCREEN_IMAGE_HEIGHT,
  FULLSCREEN_IMAGE_TILES,
  FULLSCREEN_IMAGE_WIDTH,
  containImage,
  isMotionThumbnail,
} from './post-image.js'

describe('containImage', () => {
  it('letterboxes a landscape image without cropping', () => {
    expect(containImage(1200, 800, FULLSCREEN_IMAGE_WIDTH, FULLSCREEN_IMAGE_HEIGHT)).toEqual({
      x: 72,
      y: 0,
      width: 432,
      height: 288,
    })
  })

  it('pillarboxes a portrait image without cropping', () => {
    expect(containImage(800, 1200, FULLSCREEN_IMAGE_WIDTH, FULLSCREEN_IMAGE_HEIGHT)).toEqual({
      x: 192,
      y: 0,
      width: 192,
      height: 288,
    })
  })

  it('covers the 576x288 display with four SDK-sized image tiles', () => {
    expect(FULLSCREEN_IMAGE_TILES).toEqual([
      { x: 0, y: 0, width: 288, height: 144 },
      { x: 288, y: 0, width: 288, height: 144 },
      { x: 0, y: 144, width: 288, height: 144 },
      { x: 288, y: 144, width: 288, height: 144 },
    ])
    expect(FULLSCREEN_IMAGE_TILES.every((tile) => tile.width <= 288 && tile.height <= 144)).toBe(
      true,
    )
  })

  it('rejects invalid source dimensions', () => {
    expect(() => containImage(0, 1200, 288, 96)).toThrow('Invalid image dimensions')
  })

  it('marks video and animated GIF posters as motion thumbnails', () => {
    expect(isMotionThumbnail('photo')).toBe(false)
    expect(isMotionThumbnail('video_thumbnail')).toBe(true)
    expect(isMotionThumbnail('animated_gif_thumbnail')).toBe(true)
  })
})

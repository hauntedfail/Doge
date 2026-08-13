import { describe, expect, it } from 'vitest'
import { containImage } from './post-image.js'

describe('containImage', () => {
  it('letterboxes a landscape image without cropping', () => {
    expect(containImage(1200, 800, 288, 96)).toEqual({ x: 72, y: 0, width: 144, height: 96 })
  })

  it('pillarboxes a portrait image without cropping', () => {
    expect(containImage(800, 1200, 288, 96)).toEqual({ x: 112, y: 0, width: 64, height: 96 })
  })

  it('rejects invalid source dimensions', () => {
    expect(() => containImage(0, 1200, 288, 96)).toThrow('Invalid image dimensions')
  })
})

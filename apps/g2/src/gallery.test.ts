import { describe, expect, it } from 'vitest'
import { galleryTitle, slideGalleryIndex } from './gallery.js'

describe('Gallery navigation', () => {
  it('identifies the dedicated mode and current image in its title', () => {
    expect(galleryTitle(0, 4)).toBe('GALLERY  ·  1/4')
    expect(galleryTitle(3, 4)).toBe('GALLERY  ·  4/4')
  })

  it('slides within the post media bounds without wrapping', () => {
    expect(slideGalleryIndex(0, 4, 'previous')).toBe(0)
    expect(slideGalleryIndex(0, 4, 'next')).toBe(1)
    expect(slideGalleryIndex(2, 4, 'next')).toBe(3)
    expect(slideGalleryIndex(3, 4, 'next')).toBe(3)
    expect(slideGalleryIndex(3, 4, 'previous')).toBe(2)
  })
})

export type GallerySlideDirection = 'next' | 'previous'

export function galleryTitle(index: number, imageCount: number): string {
  const safeCount = Math.max(1, Math.trunc(imageCount))
  const safeIndex = Math.min(Math.max(0, Math.trunc(index)), safeCount - 1)
  return `GALLERY  ·  ${safeIndex + 1}/${safeCount}`
}

export function slideGalleryIndex(
  index: number,
  imageCount: number,
  direction: GallerySlideDirection,
): number {
  if (imageCount <= 0) return 0
  const delta = direction === 'next' ? 1 : -1
  return Math.min(Math.max(0, index + delta), imageCount - 1)
}

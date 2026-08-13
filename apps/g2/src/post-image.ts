import type { PostImageKind } from '@even-g2-x-reader/contracts'
import { canvasPngBytes } from './image-bytes.js'

export const FULLSCREEN_IMAGE_WIDTH = 576
export const FULLSCREEN_IMAGE_HEIGHT = 288
export const FULLSCREEN_IMAGE_TILE_WIDTH = 288
export const FULLSCREEN_IMAGE_TILE_HEIGHT = 144
export type PostImageLayout = 'fullscreen' | 'gallery'

export interface ImageRectangle {
  x: number
  y: number
  width: number
  height: number
}

export const FULLSCREEN_IMAGE_VIEWPORT: ImageRectangle = {
  x: 0,
  y: 0,
  width: FULLSCREEN_IMAGE_WIDTH,
  height: FULLSCREEN_IMAGE_HEIGHT,
}
export const GALLERY_IMAGE_VIEWPORT: ImageRectangle = {
  x: 0,
  y: 32,
  width: FULLSCREEN_IMAGE_WIDTH,
  height: FULLSCREEN_IMAGE_HEIGHT - 32,
}

export const FULLSCREEN_IMAGE_TILES = [
  { x: 0, y: 0, width: FULLSCREEN_IMAGE_TILE_WIDTH, height: FULLSCREEN_IMAGE_TILE_HEIGHT },
  {
    x: FULLSCREEN_IMAGE_TILE_WIDTH,
    y: 0,
    width: FULLSCREEN_IMAGE_TILE_WIDTH,
    height: FULLSCREEN_IMAGE_TILE_HEIGHT,
  },
  {
    x: 0,
    y: FULLSCREEN_IMAGE_TILE_HEIGHT,
    width: FULLSCREEN_IMAGE_TILE_WIDTH,
    height: FULLSCREEN_IMAGE_TILE_HEIGHT,
  },
  {
    x: FULLSCREEN_IMAGE_TILE_WIDTH,
    y: FULLSCREEN_IMAGE_TILE_HEIGHT,
    width: FULLSCREEN_IMAGE_TILE_WIDTH,
    height: FULLSCREEN_IMAGE_TILE_HEIGHT,
  },
] as const satisfies readonly ImageRectangle[]

export type FullscreenImageTileData = readonly [Uint8Array, Uint8Array, Uint8Array, Uint8Array]

export function containImage(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): ImageRectangle {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    !Number.isFinite(targetWidth) ||
    !Number.isFinite(targetHeight) ||
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    targetWidth <= 0 ||
    targetHeight <= 0
  ) {
    throw new Error('Invalid image dimensions')
  }
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight)
  const width = Math.round(sourceWidth * scale)
  const height = Math.round(sourceHeight * scale)
  return {
    x: Math.round((targetWidth - width) / 2),
    y: Math.round((targetHeight - height) / 2),
    width,
    height,
  }
}

export function containImageInViewport(
  sourceWidth: number,
  sourceHeight: number,
  viewport: ImageRectangle,
): ImageRectangle {
  const contained = containImage(sourceWidth, sourceHeight, viewport.width, viewport.height)
  return {
    ...contained,
    x: viewport.x + contained.x,
    y: viewport.y + contained.y,
  }
}

export function isMotionThumbnail(kind: PostImageKind): boolean {
  return kind === 'video_thumbnail' || kind === 'animated_gif_thumbnail'
}

function imageViewport(layout: PostImageLayout): ImageRectangle {
  return layout === 'gallery' ? GALLERY_IMAGE_VIEWPORT : FULLSCREEN_IMAGE_VIEWPORT
}

function drawGalleryTitle(context: CanvasRenderingContext2D, title?: string): void {
  if (!title) return
  context.fillStyle = '#fff'
  context.font = '20px sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(title, FULLSCREEN_IMAGE_WIDTH / 2, GALLERY_IMAGE_VIEWPORT.y / 2)
}

function drawPlayBadge(
  context: CanvasRenderingContext2D,
  kind: PostImageKind,
  viewport: ImageRectangle,
): void {
  if (!isMotionThumbnail(kind)) return
  const centreX = viewport.x + viewport.width / 2
  const centreY = viewport.y + viewport.height / 2
  context.fillStyle = '#000'
  context.strokeStyle = '#fff'
  context.lineWidth = 2
  context.beginPath()
  context.arc(centreX, centreY, 20, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.fillStyle = '#fff'
  context.beginPath()
  context.moveTo(centreX - 6, centreY - 11)
  context.lineTo(centreX + 12, centreY)
  context.lineTo(centreX - 6, centreY + 11)
  context.closePath()
  context.fill()
}

function renderTiles(canvas: HTMLCanvasElement): FullscreenImageTileData {
  const renderTile = (tile: ImageRectangle): Uint8Array => {
    const tileCanvas = document.createElement('canvas')
    tileCanvas.width = tile.width
    tileCanvas.height = tile.height
    const context = tileCanvas.getContext('2d')
    if (!context) throw new Error('Unable to create image tile canvas')
    context.drawImage(
      canvas,
      tile.x,
      tile.y,
      tile.width,
      tile.height,
      0,
      0,
      tile.width,
      tile.height,
    )
    return canvasPngBytes(tileCanvas)
  }
  return [
    renderTile(FULLSCREEN_IMAGE_TILES[0]),
    renderTile(FULLSCREEN_IMAGE_TILES[1]),
    renderTile(FULLSCREEN_IMAGE_TILES[2]),
    renderTile(FULLSCREEN_IMAGE_TILES[3]),
  ]
}

export function renderPostImagePlaceholderTiles(
  kind: PostImageKind,
  layout: PostImageLayout = 'fullscreen',
  title?: string,
): FullscreenImageTileData {
  const canvas = document.createElement('canvas')
  canvas.width = FULLSCREEN_IMAGE_WIDTH
  canvas.height = FULLSCREEN_IMAGE_HEIGHT
  const context = canvas.getContext('2d')
  if (context) {
    const viewport = imageViewport(layout)
    context.fillStyle = '#000'
    context.fillRect(0, 0, FULLSCREEN_IMAGE_WIDTH, FULLSCREEN_IMAGE_HEIGHT)
    context.strokeStyle = '#fff'
    context.lineWidth = 2
    context.strokeRect(viewport.x + 1, viewport.y + 1, viewport.width - 2, viewport.height - 2)
    context.beginPath()
    context.moveTo(viewport.x + viewport.width * 0.06, viewport.y + viewport.height * 0.88)
    context.lineTo(viewport.x + viewport.width * 0.3, viewport.y + viewport.height * 0.35)
    context.lineTo(viewport.x + viewport.width * 0.46, viewport.y + viewport.height * 0.69)
    context.lineTo(viewport.x + viewport.width * 0.64, viewport.y + viewport.height * 0.25)
    context.lineTo(viewport.x + viewport.width * 0.94, viewport.y + viewport.height * 0.88)
    context.stroke()
    drawPlayBadge(context, kind, viewport)
    drawGalleryTitle(context, title)
  }
  return renderTiles(canvas)
}

export async function renderPostImageTiles(
  imageBlob: Blob,
  kind: PostImageKind,
  layout: PostImageLayout = 'fullscreen',
  title?: string,
): Promise<FullscreenImageTileData> {
  const objectUrl = URL.createObjectURL(imageBlob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = FULLSCREEN_IMAGE_WIDTH
    canvas.height = FULLSCREEN_IMAGE_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to create image canvas')
    context.fillStyle = '#000'
    context.fillRect(0, 0, FULLSCREEN_IMAGE_WIDTH, FULLSCREEN_IMAGE_HEIGHT)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const viewport = imageViewport(layout)
    const rect = containImageInViewport(image.naturalWidth, image.naturalHeight, viewport)
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height)
    drawPlayBadge(context, kind, viewport)
    drawGalleryTitle(context, title)
    return renderTiles(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

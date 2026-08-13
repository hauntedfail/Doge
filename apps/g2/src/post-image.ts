import type { PostImageKind } from '@even-g2-x-reader/contracts'
import { canvasPngBytes } from './image-bytes.js'

export const FULLSCREEN_IMAGE_WIDTH = 576
export const FULLSCREEN_IMAGE_HEIGHT = 288
export const FULLSCREEN_IMAGE_TILE_WIDTH = 288
export const FULLSCREEN_IMAGE_TILE_HEIGHT = 144

export interface ImageRectangle {
  x: number
  y: number
  width: number
  height: number
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

export function isMotionThumbnail(kind: PostImageKind): boolean {
  return kind === 'video_thumbnail' || kind === 'animated_gif_thumbnail'
}

function drawPlayBadge(context: CanvasRenderingContext2D, kind: PostImageKind): void {
  if (!isMotionThumbnail(kind)) return
  const centreX = FULLSCREEN_IMAGE_WIDTH / 2
  const centreY = FULLSCREEN_IMAGE_HEIGHT / 2
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

export function renderPostImagePlaceholderTiles(kind: PostImageKind): FullscreenImageTileData {
  const canvas = document.createElement('canvas')
  canvas.width = FULLSCREEN_IMAGE_WIDTH
  canvas.height = FULLSCREEN_IMAGE_HEIGHT
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#000'
    context.fillRect(0, 0, FULLSCREEN_IMAGE_WIDTH, FULLSCREEN_IMAGE_HEIGHT)
    context.strokeStyle = '#fff'
    context.lineWidth = 2
    context.strokeRect(1, 1, FULLSCREEN_IMAGE_WIDTH - 2, FULLSCREEN_IMAGE_HEIGHT - 2)
    context.beginPath()
    context.moveTo(36, 252)
    context.lineTo(172, 102)
    context.lineTo(264, 198)
    context.lineTo(368, 72)
    context.lineTo(540, 252)
    context.stroke()
    drawPlayBadge(context, kind)
  }
  return renderTiles(canvas)
}

export async function renderPostImageTiles(
  imageBlob: Blob,
  kind: PostImageKind,
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
    const rect = containImage(
      image.naturalWidth,
      image.naturalHeight,
      FULLSCREEN_IMAGE_WIDTH,
      FULLSCREEN_IMAGE_HEIGHT,
    )
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height)
    drawPlayBadge(context, kind)
    return renderTiles(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

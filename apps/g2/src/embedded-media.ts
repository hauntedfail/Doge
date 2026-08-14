import type { PostImage } from '@even-g2-x-reader/contracts'
import { canvasPngBytes } from './image-bytes.js'
import { containImageInViewport, isMotionThumbnail, type ImageRectangle } from './post-image.js'

export type EmbeddedMediaPageKind =
  'reader-media-empty' | 'reader-media-tall' | 'reader-media-medium' | 'reader-media-compact'

export interface EmbeddedMediaLayout {
  pageKind: EmbeddedMediaPageKind
  y: number
  width: number
  height: number
  tiles: readonly [ImageRectangle, ImageRectangle]
  slots: readonly ImageRectangle[]
}

export type EmbeddedMediaTileData = readonly [Uint8Array, Uint8Array]
export type EmbeddedMediaLoadState =
  { status: 'loading' } | { status: 'ready'; blob: Blob } | { status: 'error' }

const MEDIA_X = 8
const MEDIA_WIDTH = 560
const TILE_WIDTH = MEDIA_WIDTH / 2
const SLOT_GAP = 4

function slotsFor(imageCount: number, height: number): ImageRectangle[] {
  const halfWidth = (MEDIA_WIDTH - SLOT_GAP) / 2
  const halfHeight = (height - SLOT_GAP) / 2
  if (imageCount === 1) return [{ x: 0, y: 0, width: MEDIA_WIDTH, height }]
  if (imageCount === 2) {
    return [
      { x: 0, y: 0, width: halfWidth, height },
      { x: halfWidth + SLOT_GAP, y: 0, width: halfWidth, height },
    ]
  }
  if (imageCount === 3) {
    return [
      { x: 0, y: 0, width: halfWidth, height },
      { x: halfWidth + SLOT_GAP, y: 0, width: halfWidth, height: halfHeight },
      {
        x: halfWidth + SLOT_GAP,
        y: halfHeight + SLOT_GAP,
        width: halfWidth,
        height: halfHeight,
      },
    ]
  }
  return [
    { x: 0, y: 0, width: halfWidth, height: halfHeight },
    { x: 0, y: halfHeight + SLOT_GAP, width: halfWidth, height: halfHeight },
    { x: halfWidth + SLOT_GAP, y: 0, width: halfWidth, height: halfHeight },
    {
      x: halfWidth + SLOT_GAP,
      y: halfHeight + SLOT_GAP,
      width: halfWidth,
      height: halfHeight,
    },
  ]
}

export function embeddedMediaLayout(
  bodyLineCount: number,
  imageCount: number,
): EmbeddedMediaLayout {
  if (!Number.isInteger(imageCount) || imageCount < 1 || imageCount > 4) {
    throw new Error('Embedded media count must be an integer from 1 to 4')
  }
  const lines = Math.min(3, Math.max(0, Math.round(bodyLineCount)))
  const y = 68 + lines * 26
  const height = Math.min(144, 250 - y)
  const pageKind: EmbeddedMediaPageKind =
    lines === 0
      ? 'reader-media-empty'
      : lines === 1
        ? 'reader-media-tall'
        : lines === 2
          ? 'reader-media-medium'
          : 'reader-media-compact'
  return {
    pageKind,
    y,
    width: MEDIA_WIDTH,
    height,
    tiles: [
      { x: MEDIA_X, y, width: TILE_WIDTH, height },
      { x: MEDIA_X + TILE_WIDTH, y, width: TILE_WIDTH, height },
    ],
    slots: slotsFor(imageCount, height),
  }
}

export function embeddedMediaTileIndexes(
  layout: EmbeddedMediaLayout,
  imageIndex: number,
): readonly (0 | 1)[] {
  const slot = layout.slots[imageIndex]
  if (!slot) return []
  const midpoint = layout.width / 2
  const indexes: (0 | 1)[] = []
  if (slot.x < midpoint) indexes.push(0)
  if (slot.x + slot.width > midpoint) indexes.push(1)
  return indexes
}

function drawPlayBadge(
  context: CanvasRenderingContext2D,
  image: PostImage,
  slot: ImageRectangle,
): void {
  if (!isMotionThumbnail(image.kind)) return
  const centreX = slot.x + slot.width / 2
  const centreY = slot.y + slot.height / 2
  context.fillStyle = '#000'
  context.strokeStyle = '#fff'
  context.lineWidth = 2
  context.beginPath()
  context.arc(centreX, centreY, 14, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.fillStyle = '#fff'
  context.beginPath()
  context.moveTo(centreX - 4, centreY - 8)
  context.lineTo(centreX + 8, centreY)
  context.lineTo(centreX - 4, centreY + 8)
  context.closePath()
  context.fill()
}

async function decodedImage(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

function renderTiles(
  canvas: HTMLCanvasElement,
  layout: EmbeddedMediaLayout,
): EmbeddedMediaTileData {
  const renderTile = (tile: ImageRectangle, index: number): Uint8Array => {
    const tileCanvas = document.createElement('canvas')
    tileCanvas.width = tile.width
    tileCanvas.height = tile.height
    const context = tileCanvas.getContext('2d')
    if (!context) throw new Error('Unable to create embedded media tile')
    context.drawImage(
      canvas,
      index * tile.width,
      0,
      tile.width,
      tile.height,
      0,
      0,
      tile.width,
      tile.height,
    )
    return canvasPngBytes(tileCanvas)
  }
  return [renderTile(layout.tiles[0], 0), renderTile(layout.tiles[1], 1)]
}

export async function renderEmbeddedMediaTiles(
  images: readonly PostImage[],
  states: readonly EmbeddedMediaLoadState[],
  layout: EmbeddedMediaLayout,
): Promise<EmbeddedMediaTileData> {
  const canvas = document.createElement('canvas')
  canvas.width = layout.width
  canvas.height = layout.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Unable to create embedded media canvas')
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  for (const [index, image] of images.entries()) {
    const slot = layout.slots[index]
    if (!slot) continue
    const state = states[index] ?? { status: 'loading' as const }
    context.strokeStyle = '#fff'
    context.lineWidth = 1
    context.strokeRect(slot.x + 1, slot.y + 1, slot.width - 2, slot.height - 2)
    if (state.status === 'ready') {
      const decoded = await decodedImage(state.blob)
      const inset = 2
      const viewport = {
        x: slot.x + inset,
        y: slot.y + inset,
        width: slot.width - inset * 2,
        height: slot.height - inset * 2,
      }
      const rect = containImageInViewport(decoded.naturalWidth, decoded.naturalHeight, viewport)
      context.drawImage(decoded, rect.x, rect.y, rect.width, rect.height)
      drawPlayBadge(context, image, slot)
      continue
    }
    context.fillStyle = '#fff'
    context.font = `${Math.max(12, Math.min(17, Math.floor(slot.height / 5)))}px sans-serif`
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    const label =
      state.status === 'error' ? 'IMAGE UNAVAILABLE' : `${index + 1}/${images.length} · LOADING`
    context.fillText(label, slot.x + slot.width / 2, slot.y + slot.height / 2)
  }
  return renderTiles(canvas, layout)
}

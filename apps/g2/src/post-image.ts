export const POST_IMAGE_WIDTH = 288
export const POST_IMAGE_HEIGHT = 96

export interface ImageRectangle {
  x: number
  y: number
  width: number
  height: number
}

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

function canvasData(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',', 2)[1] ?? ''
}

export function renderPostImagePlaceholder(): string {
  const canvas = document.createElement('canvas')
  canvas.width = POST_IMAGE_WIDTH
  canvas.height = POST_IMAGE_HEIGHT
  const context = canvas.getContext('2d')
  if (context) {
    context.fillStyle = '#000'
    context.fillRect(0, 0, POST_IMAGE_WIDTH, POST_IMAGE_HEIGHT)
    context.strokeStyle = '#fff'
    context.lineWidth = 2
    context.strokeRect(1, 1, POST_IMAGE_WIDTH - 2, POST_IMAGE_HEIGHT - 2)
    context.beginPath()
    context.moveTo(18, 78)
    context.lineTo(86, 34)
    context.lineTo(132, 66)
    context.lineTo(184, 24)
    context.lineTo(270, 78)
    context.stroke()
  }
  return canvasData(canvas)
}

export async function renderPostImage(imageBlob: Blob): Promise<string> {
  const objectUrl = URL.createObjectURL(imageBlob)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = objectUrl
    await image.decode()

    const canvas = document.createElement('canvas')
    canvas.width = POST_IMAGE_WIDTH
    canvas.height = POST_IMAGE_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to create image canvas')
    context.fillStyle = '#000'
    context.fillRect(0, 0, POST_IMAGE_WIDTH, POST_IMAGE_HEIGHT)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const rect = containImage(
      image.naturalWidth,
      image.naturalHeight,
      POST_IMAGE_WIDTH,
      POST_IMAGE_HEIGHT,
    )
    context.drawImage(image, rect.x, rect.y, rect.width, rect.height)
    return canvasData(canvas)
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

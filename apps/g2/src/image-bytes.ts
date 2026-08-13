const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

export function encodedPngBytes(dataUrl: string): Uint8Array {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new Error('Expected a base64-encoded PNG data URL')
  }

  const encoded = dataUrl.slice(PNG_DATA_URL_PREFIX.length)
  let binary: string
  try {
    binary = atob(encoded)
  } catch {
    throw new Error('Invalid base64-encoded PNG data URL')
  }

  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (
    bytes.length < 8 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    throw new Error('Decoded image is not a PNG')
  }
  return bytes
}

export function canvasPngBytes(canvas: HTMLCanvasElement): Uint8Array {
  return encodedPngBytes(canvas.toDataURL('image/png'))
}

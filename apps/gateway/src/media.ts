const MAX_MEDIA_BYTES = 4 * 1024 * 1024
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MEDIA_PATH = /^\/media\/[A-Za-z0-9_-]+(?:\.(jpe?g|png|webp))?$/iu
const ALLOWED_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp'])
const ALLOWED_NAMES = new Set(['small', 'medium', 'large', 'orig', '4096x4096'])

function normaliseFormat(value: string): string {
  return value.toLowerCase() === 'jpeg' ? 'jpg' : value.toLowerCase()
}

export function parseMediaUrl(value: string | undefined): URL | null {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'pbs.twimg.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      !MEDIA_PATH.test(url.pathname)
    ) {
      return null
    }

    for (const key of url.searchParams.keys()) {
      if ((key !== 'format' && key !== 'name') || url.searchParams.getAll(key).length !== 1) {
        return null
      }
    }
    const pathFormat = url.pathname.match(/\.(jpe?g|png|webp)$/iu)?.[1]
    const queryFormat = url.searchParams.get('format')
    const name = url.searchParams.get('name')
    if (queryFormat && !ALLOWED_FORMATS.has(queryFormat.toLowerCase())) return null
    if (name && !ALLOWED_NAMES.has(name.toLowerCase())) return null
    if (!pathFormat && !queryFormat) return null
    if (pathFormat && queryFormat && normaliseFormat(pathFormat) !== normaliseFormat(queryFormat)) {
      return null
    }

    url.search = ''
    if (queryFormat) {
      url.searchParams.set('format', normaliseFormat(queryFormat))
      url.searchParams.set('name', 'small')
    }
    return url
  } catch {
    return null
  }
}

export interface PostMediaImage {
  bytes: Uint8Array
  contentType: string
}

function hasExpectedSignature(bytes: Uint8Array, contentType: string): boolean {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }
  if (contentType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
  }
  return (
    contentType === 'image/webp' &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  )
}

export async function loadPostMedia(url: URL): Promise<PostMediaImage> {
  const response = await fetch(url, {
    headers: { accept: 'image/jpeg,image/png,image/webp' },
    redirect: 'manual',
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`media origin returned HTTP ${response.status}`)

  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error('media origin returned an unsupported content type')
  }
  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (contentLength > MAX_MEDIA_BYTES) throw new Error('media exceeds 4 MB')
  if (!response.body) throw new Error('media has no response body')

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_MEDIA_BYTES) {
      await reader.cancel()
      throw new Error('media exceeds 4 MB')
    }
    chunks.push(value)
  }
  if (total === 0) throw new Error('media has an invalid size')

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  if (!hasExpectedSignature(bytes, contentType)) {
    throw new Error('media content does not match its declared type')
  }
  return { bytes, contentType }
}

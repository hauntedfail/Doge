const MAX_AVATAR_BYTES = 512 * 1024
const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const PROFILE_IMAGE_PATH =
  /^\/profile_images\/\d+\/[A-Za-z0-9_-]+(?:_(?:normal|bigger|mini|400x400))?\.(?:jpe?g|png|webp)$/iu

export function parseAvatarUrl(value: string | undefined): URL | null {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'pbs.twimg.com' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !PROFILE_IMAGE_PATH.test(url.pathname)
    ) {
      return null
    }
    return url
  } catch {
    return null
  }
}

export interface AvatarImage {
  bytes: Uint8Array
  contentType: string
}

export async function loadAvatar(url: URL): Promise<AvatarImage> {
  const response = await fetch(url, {
    headers: { accept: 'image/jpeg,image/png,image/webp' },
    redirect: 'manual',
    signal: AbortSignal.timeout(5_000),
  })
  if (!response.ok) throw new Error(`avatar origin returned HTTP ${response.status}`)

  const contentType = response.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (!contentType || !ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new Error('avatar origin returned an unsupported content type')
  }
  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (contentLength > MAX_AVATAR_BYTES) throw new Error('avatar exceeds 512 KB')

  if (!response.body) throw new Error('avatar has no response body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_AVATAR_BYTES) {
      await reader.cancel()
      throw new Error('avatar exceeds 512 KB')
    }
    chunks.push(value)
  }
  if (total === 0) throw new Error('avatar has an invalid size')
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return { bytes, contentType }
}

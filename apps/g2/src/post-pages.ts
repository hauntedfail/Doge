import { getTextWidth } from '@evenrealities/pretext'
import { TEXT_CONTAINER_UPGRADE_MAX_CHARACTERS } from './text-container-lifecycle.js'

export const POST_BODY_WIDTH = 560
export const PLAIN_BODY_LINES = 7
export const EMBEDDED_MEDIA_BODY_LINES = 3
// textContainerUpgrade accepts up to 2,000 UTF-16 code units. Layout rebuilds
// first create a rebuild-safe prefix, then hydrate the full chunk in place.
export const POST_BODY_CHUNK_MAX_CHARACTERS = TEXT_CONTAINER_UPGRADE_MAX_CHARACTERS

export interface PostDisplayFrame {
  body: string
  showMedia: boolean
}

function isBreakable(character: string): boolean {
  const codePoint = character.codePointAt(0) ?? 0
  return (
    character === ' ' ||
    character === '-' ||
    (codePoint >= 0x2e80 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af)
  )
}

function advanceWidth(characters: string[], index: number): number {
  const character = characters[index] ?? ''
  const next = characters[index + 1]
  if (!next) return getTextWidth(character)
  return getTextWidth(character + next) - getTextWidth(next)
}

// pretext exposes the final LVGL line count but not its source boundaries.
// Mirror the same break rules so the media block can own the final three
// rendered lines without losing or duplicating any post characters.
export function splitPostBodyLines(text: string): string[] {
  if (!text) return ['']
  const characters = Array.from(text)
  const lines: string[] = []
  let lineStart = 0
  let currentWidth = 0
  let lastBreakIndex = -1
  let index = 0

  const pushLine = (end: number) => {
    lines.push(characters.slice(lineStart, end).join(''))
    lineStart = end
  }

  while (index < characters.length) {
    const character = characters[index] ?? ''
    if (character === '\n') {
      pushLine(index + 1)
      currentWidth = 0
      lastBreakIndex = -1
      index += 1
      continue
    }
    if (currentWidth === 0 && character === ' ') {
      index += 1
      continue
    }

    const width = advanceWidth(characters, index)
    if (currentWidth + width > POST_BODY_WIDTH) {
      if (character === ' ') {
        pushLine(index + 1)
        currentWidth = 0
        lastBreakIndex = -1
        index += 1
      } else if (lastBreakIndex >= lineStart) {
        pushLine(lastBreakIndex + 1)
        currentWidth = 0
        index = lastBreakIndex + 1
        lastBreakIndex = -1
      } else {
        pushLine(index)
        currentWidth = width
        lastBreakIndex = isBreakable(character) ? index : -1
        index += 1
      }
      continue
    }

    currentWidth += width
    if (isBreakable(character)) lastBreakIndex = index
    index += 1
  }

  if (lineStart < characters.length) pushLine(characters.length)
  if (characters.at(-1) === '\n') lines.push('')
  return lines
}

function splitByCodeUnitLimit(text: string, limit: number): string[] {
  const chunks: string[] = []
  let chunk = ''
  for (const character of Array.from(text)) {
    if (chunk && chunk.length + character.length > limit) {
      chunks.push(chunk)
      chunk = ''
    }
    chunk += character
  }
  if (chunk || text === '') chunks.push(chunk)
  return chunks
}

function chunkLines(lines: string[]): string[] {
  const chunks: string[] = []
  let chunk = ''
  const push = () => {
    if (!chunk) return
    chunks.push(chunk)
    chunk = ''
  }

  for (const line of lines) {
    for (const fragment of splitByCodeUnitLimit(line, POST_BODY_CHUNK_MAX_CHARACTERS)) {
      if (chunk && chunk.length + fragment.length > POST_BODY_CHUNK_MAX_CHARACTERS) push()
      if (fragment.length === POST_BODY_CHUNK_MAX_CHARACTERS) {
        push()
        chunks.push(fragment)
      } else {
        chunk += fragment
      }
    }
  }
  push()
  return chunks
}

export function scrollPostBody(text: string, imageCount: number): PostDisplayFrame[] {
  if (!Number.isInteger(imageCount) || imageCount < 0 || imageCount > 4) {
    throw new Error('Image count must be an integer from 0 to 4')
  }
  const lines = splitPostBodyLines(text)
  if (imageCount === 0) {
    const chunks = chunkLines(lines)
    return (chunks.length > 0 ? chunks : ['']).map((body) => ({ body, showMedia: false }))
  }

  // The final three rendered lines share a frame with the media grid. All
  // earlier text remains in order inside firmware-scrollable text chunks.
  const mediaLineStart = Math.max(0, lines.length - EMBEDDED_MEDIA_BODY_LINES)
  const textChunks = chunkLines(lines.slice(0, mediaLineStart)).map((body) => ({
    body,
    showMedia: false,
  }))
  return [...textChunks, { body: lines.slice(mediaLineStart).join(''), showMedia: true }]
}

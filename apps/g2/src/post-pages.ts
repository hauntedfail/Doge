import { getTextWidth, measureTextWrap } from '@evenrealities/pretext'

export const POST_BODY_WIDTH = 560
export const PLAIN_BODY_LINES = 5
export const MEDIA_BODY_LINES = 1

export interface PostDisplayFrame {
  body: string
  showsImage: boolean
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
// Mirror the same break rules so a swipe can discard exactly one rendered line
// without losing any characters from the full post.
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

// Stop at the first frame whose remaining suffix fits, just like a normal
// scroll view stops with its final line at the bottom instead of the top.
function rollingTextFrames(lines: string[]): PostDisplayFrame[] {
  const frames: PostDisplayFrame[] = []
  for (let start = 0; start < lines.length; start += 1) {
    let body = lines[start] ?? ''
    for (let end = start + 2; end <= lines.length; end += 1) {
      const candidate = lines.slice(start, end).join('')
      if (measureTextWrap(candidate, POST_BODY_WIDTH).lineCount > PLAIN_BODY_LINES) break
      body = candidate
    }
    frames.push({ body, showsImage: false })
    const remaining = lines.slice(start).join('')
    if (measureTextWrap(remaining, POST_BODY_WIDTH).lineCount <= PLAIN_BODY_LINES) break
  }
  return frames
}

export function scrollPostBody(text: string, hasImage: boolean): PostDisplayFrame[] {
  const lines = splitPostBodyLines(text)
  if (!hasImage) return rollingTextFrames(lines)
  const mediaFrame = { body: lines.slice(-MEDIA_BODY_LINES).join(''), showsImage: true }
  if (lines.length <= MEDIA_BODY_LINES) return [mediaFrame]
  return [...rollingTextFrames(lines), mediaFrame]
}

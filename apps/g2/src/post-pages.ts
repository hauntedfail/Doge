import { measureTextWrap } from '@evenrealities/pretext'

export const POST_BODY_WIDTH = 560
export const PLAIN_BODY_LINES = 4
export const MEDIA_BODY_LINES = 1

export interface PostDisplayPage {
  body: string
  showsImage: boolean
}

function prefixThatFits(text: string, maxLines: number): string {
  const characters = Array.from(text)
  let low = 1
  let high = characters.length
  let best = 0
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = characters.slice(0, middle).join('')
    if (measureTextWrap(candidate, POST_BODY_WIDTH).lineCount <= maxLines) {
      best = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return characters.slice(0, Math.max(1, best)).join('')
}

function paginateByLines(text: string, maxLines: number): string[] {
  const pages: string[] = []
  let remaining = text
  while (remaining) {
    const page = prefixThatFits(remaining, maxLines)
    pages.push(page)
    remaining = remaining.slice(page.length)
  }
  return pages
}

function suffixThatFits(text: string, maxLines: number): string {
  const characters = Array.from(text)
  let low = 0
  let high = characters.length
  let best = 0
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = characters.slice(characters.length - middle).join('')
    if (measureTextWrap(candidate, POST_BODY_WIDTH).lineCount <= maxLines) {
      best = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return characters.slice(characters.length - best).join('')
}

export function paginatePostBody(text: string, hasImage: boolean): PostDisplayPage[] {
  if (!hasImage) {
    const pages = paginateByLines(text, PLAIN_BODY_LINES)
    return (pages.length ? pages : ['']).map((body) => ({ body, showsImage: false }))
  }

  const finalLine = suffixThatFits(text, MEDIA_BODY_LINES)
  const prefix = text.slice(0, Math.max(0, text.length - finalLine.length))
  return [
    ...paginateByLines(prefix, PLAIN_BODY_LINES).map((body) => ({ body, showsImage: false })),
    { body: finalLine, showsImage: true },
  ]
}

import { getTextWidth } from '@evenrealities/pretext'

export const READER_FOOTER_WIDTH = 560

const SPACER = '\u00A0'
const SPACER_WIDTH = getTextWidth(SPACER)

export function footerPositionContent(
  pagePosition: string,
  postPosition: string,
  width = READER_FOOTER_WIDTH,
): string {
  const left = pagePosition.trim()
  const right = postPosition.trim()
  if (!right) return left

  let spacerCount = Math.max(
    1,
    Math.floor((width - getTextWidth(left) - getTextWidth(right)) / SPACER_WIDTH),
  )
  let content = `${left}${SPACER.repeat(spacerCount)}${right}`
  while (spacerCount > 1 && getTextWidth(content) > width) {
    spacerCount -= 1
    content = `${left}${SPACER.repeat(spacerCount)}${right}`
  }
  while (getTextWidth(`${left}${SPACER.repeat(spacerCount + 1)}${right}`) <= width) {
    spacerCount += 1
    content = `${left}${SPACER.repeat(spacerCount)}${right}`
  }
  return content
}

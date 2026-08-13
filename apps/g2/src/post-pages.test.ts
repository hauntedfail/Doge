import { measureTextWrap } from '@evenrealities/pretext'
import { describe, expect, it } from 'vitest'
import {
  MEDIA_BODY_LINES,
  PLAIN_BODY_LINES,
  POST_BODY_WIDTH,
  paginatePostBody,
} from './post-pages.js'

describe('paginatePostBody', () => {
  it('uses the reclaimed footer row for a fifth line of post text', () => {
    expect(PLAIN_BODY_LINES).toBe(5)
  })

  it('preserves every character while fitting text-only pages', () => {
    const body = '日本語とEnglish wordsを混ぜた長い本文。'.repeat(80)
    const pages = paginatePostBody(body, false)

    expect(pages.map((page) => page.body).join('')).toBe(body)
    expect(
      pages.every(
        (page) => measureTextWrap(page.body, POST_BODY_WIDTH).lineCount <= PLAIN_BODY_LINES,
      ),
    ).toBe(true)
    expect(pages.every((page) => !page.showsImage)).toBe(true)
  })

  it('shows the image only after the final, fully preserved text segment', () => {
    const body = 'A post with an image and enough text to span several display lines. '.repeat(30)
    const pages = paginatePostBody(body, true)
    const finalPage = pages.at(-1)

    expect(pages.map((page) => page.body).join('')).toBe(body)
    expect(pages.slice(0, -1).every((page) => !page.showsImage)).toBe(true)
    expect(finalPage?.showsImage).toBe(true)
    expect(measureTextWrap(finalPage?.body ?? '', POST_BODY_WIDTH).lineCount).toBeLessThanOrEqual(
      MEDIA_BODY_LINES,
    )
  })
})

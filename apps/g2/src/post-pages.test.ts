import { measureTextWrap } from '@evenrealities/pretext'
import { describe, expect, it } from 'vitest'
import {
  PLAIN_BODY_LINES,
  POST_BODY_WIDTH,
  scrollPostBody,
  splitPostBodyLines,
} from './post-pages.js'

describe('scrollPostBody', () => {
  it('uses the removed header space for seven text lines', () => {
    expect(PLAIN_BODY_LINES).toBe(7)
  })

  it('preserves every character while moving the viewport by one visual line', () => {
    const body = '日本語とEnglish wordsを混ぜた長い本文。'.repeat(80)
    const lines = splitPostBodyLines(body)
    const frames = scrollPostBody(body, 0)

    expect(lines.join('')).toBe(body)
    expect(frames[0]?.body).toBe(lines.slice(0, PLAIN_BODY_LINES).join(''))
    expect(frames[1]?.body).toBe(lines.slice(1, PLAIN_BODY_LINES + 1).join(''))
    expect(frames.at(-1)?.body).toBe(lines.slice(-PLAIN_BODY_LINES).join(''))
    expect(
      frames.every(
        (frame) => measureTextWrap(frame.body, POST_BODY_WIDTH).lineCount <= PLAIN_BODY_LINES,
      ),
    ).toBe(true)
    expect(frames.every((frame) => !frame.showMedia)).toBe(true)
  })

  it('ends with one embedded-media frame instead of full-screen pages per image', () => {
    const body = 'A post with an image and enough text to span several display lines. '.repeat(30)
    const lines = splitPostBodyLines(body)
    const frames = scrollPostBody(body, 3)
    const finalFrame = frames.at(-1)

    expect(lines.join('')).toBe(body)
    expect(finalFrame?.body).toBe(lines.slice(-3).join(''))
    expect(finalFrame?.showMedia).toBe(true)
    expect(frames.slice(0, -1).every((frame) => !frame.showMedia)).toBe(true)
  })

  it('uses a single viewport when the entire post already fits', () => {
    expect(scrollPostBody('Short post.', 0)).toEqual([{ body: 'Short post.', showMedia: false }])
  })

  it('shows short text and all attached media in the same frame', () => {
    expect(scrollPostBody('One line.', 4)).toEqual([{ body: 'One line.', showMedia: true }])
  })

  it('rejects image counts outside the X post media limit', () => {
    expect(() => scrollPostBody('Post', 5)).toThrow('Image count must be an integer from 0 to 4')
  })

  it('keeps paragraph breaks inside the visible line budget', () => {
    const body = Array.from({ length: 12 }, (_, index) => `Paragraph ${index + 1}`).join('\n\n')
    const frames = scrollPostBody(body, 0)

    expect(splitPostBodyLines(body).join('')).toBe(body)
    expect(
      frames.every(
        (frame) => measureTextWrap(frame.body, POST_BODY_WIDTH).lineCount <= PLAIN_BODY_LINES,
      ),
    ).toBe(true)
  })
})

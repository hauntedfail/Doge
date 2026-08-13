import { measureTextWrap } from '@evenrealities/pretext'
import { describe, expect, it } from 'vitest'
import {
  MEDIA_BODY_LINES,
  PLAIN_BODY_LINES,
  POST_BODY_WIDTH,
  scrollPostBody,
  splitPostBodyLines,
} from './post-pages.js'

describe('scrollPostBody', () => {
  it('uses the reclaimed footer row for a fifth line of post text', () => {
    expect(PLAIN_BODY_LINES).toBe(5)
  })

  it('preserves every character while moving the viewport by one visual line', () => {
    const body = '日本語とEnglish wordsを混ぜた長い本文。'.repeat(80)
    const lines = splitPostBodyLines(body)
    const frames = scrollPostBody(body, false)

    expect(lines.join('')).toBe(body)
    expect(frames[0]?.body).toBe(lines.slice(0, PLAIN_BODY_LINES).join(''))
    expect(frames[1]?.body).toBe(lines.slice(1, PLAIN_BODY_LINES + 1).join(''))
    expect(frames.at(-1)?.body).toBe(lines.slice(-PLAIN_BODY_LINES).join(''))
    expect(
      frames.every(
        (frame) => measureTextWrap(frame.body, POST_BODY_WIDTH).lineCount <= PLAIN_BODY_LINES,
      ),
    ).toBe(true)
    expect(frames.every((frame) => !frame.showsImage)).toBe(true)
  })

  it('shows media only after the rolling text viewport reaches the end', () => {
    const body = 'A post with an image and enough text to span several display lines. '.repeat(30)
    const lines = splitPostBodyLines(body)
    const frames = scrollPostBody(body, true)
    const finalFrame = frames.at(-1)

    expect(lines.join('')).toBe(body)
    expect(frames.slice(0, -1).every((frame) => !frame.showsImage)).toBe(true)
    expect(finalFrame).toEqual({ body: lines.at(-1), showsImage: true })
    expect(measureTextWrap(finalFrame?.body ?? '', POST_BODY_WIDTH).lineCount).toBeLessThanOrEqual(
      MEDIA_BODY_LINES,
    )
  })

  it('uses a single viewport when the entire post already fits', () => {
    expect(scrollPostBody('Short post.', false)).toEqual([
      { body: 'Short post.', showsImage: false },
    ])
  })

  it('keeps paragraph breaks inside the visible line budget', () => {
    const body = Array.from({ length: 12 }, (_, index) => `Paragraph ${index + 1}`).join('\n\n')
    const frames = scrollPostBody(body, false)

    expect(splitPostBodyLines(body).join('')).toBe(body)
    expect(
      frames.every(
        (frame) => measureTextWrap(frame.body, POST_BODY_WIDTH).lineCount <= PLAIN_BODY_LINES,
      ),
    ).toBe(true)
  })
})

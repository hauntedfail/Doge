import { measureTextWrap } from '@evenrealities/pretext'
import { describe, expect, it } from 'vitest'
import {
  POST_BODY_CHUNK_MAX_CHARACTERS,
  PLAIN_BODY_LINES,
  POST_BODY_WIDTH,
  scrollPostBody,
  splitPostBodyLines,
} from './post-pages.js'

describe('scrollPostBody', () => {
  it('uses the full text-upgrade allowance for native-scroll chunks', () => {
    expect(POST_BODY_CHUNK_MAX_CHARACTERS).toBe(2000)
  })

  it('uses the removed header space for seven text lines', () => {
    expect(PLAIN_BODY_LINES).toBe(7)
  })

  it('preserves every character in native-scroll chunks instead of one-line rolling frames', () => {
    const body = '日本語とEnglish wordsを混ぜた長い本文。'.repeat(160)
    const chunks = scrollPostBody(body, 0)

    expect(chunks.map(({ body: chunk }) => chunk).join('')).toBe(body)
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]?.body.length).toBeGreaterThan(1000)
    expect(chunks.every((chunk) => chunk.body.length <= POST_BODY_CHUNK_MAX_CHARACTERS)).toBe(true)
    expect(
      chunks
        .slice(0, -1)
        .every(
          (chunk) => measureTextWrap(chunk.body, POST_BODY_WIDTH).lineCount > PLAIN_BODY_LINES,
        ),
    ).toBe(true)
    expect(chunks.every((chunk) => !chunk.showMedia)).toBe(true)
  })

  it('ends with one embedded-media block after native-scroll text chunks', () => {
    const body = 'A post with an image and enough text to span several display lines. '.repeat(30)
    const lines = splitPostBodyLines(body)
    const chunks = scrollPostBody(body, 3)
    const finalChunk = chunks.at(-1)

    expect(lines.join('')).toBe(body)
    expect(chunks.map(({ body: chunk }) => chunk).join('')).toBe(body)
    expect(finalChunk?.body).toBe(lines.slice(-3).join(''))
    expect(finalChunk?.showMedia).toBe(true)
    expect(chunks.slice(0, -1).every((chunk) => !chunk.showMedia)).toBe(true)
    expect(chunks.every((chunk) => chunk.body.length <= POST_BODY_CHUNK_MAX_CHARACTERS)).toBe(true)
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
    const chunks = scrollPostBody(body, 0)

    expect(splitPostBodyLines(body).join('')).toBe(body)
    expect(chunks.map(({ body: chunk }) => chunk).join('')).toBe(body)
    expect(chunks).toHaveLength(1)
    expect(measureTextWrap(chunks[0]?.body ?? '', POST_BODY_WIDTH).lineCount).toBeGreaterThan(
      PLAIN_BODY_LINES,
    )
  })

  it('never splits a surrogate pair at the SDK character boundary', () => {
    const body = 'A'.repeat(POST_BODY_CHUNK_MAX_CHARACTERS - 1) + '🐕' + 'B'.repeat(1200)
    const chunks = scrollPostBody(body, 0)

    expect(chunks.map(({ body: chunk }) => chunk).join('')).toBe(body)
    expect(chunks.every((chunk) => !chunk.body.includes('\uFFFD'))).toBe(true)
    expect(chunks.every((chunk) => !/[\uD800-\uDBFF]$/u.test(chunk.body))).toBe(true)
    expect(chunks.every((chunk) => !/^[\uDC00-\uDFFF]/u.test(chunk.body))).toBe(true)
    expect(chunks.every((chunk) => chunk.body.length <= POST_BODY_CHUNK_MAX_CHARACTERS)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { encodedPngBytes } from './image-bytes.js'

describe('G2 encoded image bytes', () => {
  it('decodes a PNG data URL to Uint8Array for the native bridge', () => {
    const bytes = encodedPngBytes('data:image/png;base64,iVBORw0KGgo=')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect([...bytes]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
  })

  it('rejects non-PNG and malformed canvas payloads', () => {
    expect(() => encodedPngBytes('data:image/jpeg;base64,/9j/')).toThrow('PNG')
    expect(() => encodedPngBytes('not-a-data-url')).toThrow('PNG')
  })
})

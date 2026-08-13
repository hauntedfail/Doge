import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { G2_CANVAS_WIDTH, LOADING_LOGO_LAYOUT, shouldShowLoadingLogo } from './loading-logo.js'

describe('Doge loading logo', () => {
  it('is horizontally centred and stays inside one G2 image container', () => {
    expect(LOADING_LOGO_LAYOUT.x + LOADING_LOGO_LAYOUT.width / 2).toBe(G2_CANVAS_WIDTH / 2)
    expect(LOADING_LOGO_LAYOUT.width).toBeGreaterThanOrEqual(20)
    expect(LOADING_LOGO_LAYOUT.width).toBeLessThanOrEqual(288)
    expect(LOADING_LOGO_LAYOUT.height).toBeGreaterThanOrEqual(20)
    expect(LOADING_LOGO_LAYOUT.height).toBeLessThanOrEqual(144)
  })

  it('appears for the initial view load, but not later loading operations', () => {
    expect(shouldShowLoadingLogo('initial')).toBe(true)
    expect(shouldShowLoadingLogo('reload')).toBe(false)
    expect(shouldShowLoadingLogo('thread')).toBe(false)
    expect(shouldShowLoadingLogo('profile')).toBe(false)
  })

  it('ships a square RGBA PNG suitable for an app icon', async () => {
    const bytes = await readFile(new URL('../public/doge-icon.png', import.meta.url))

    expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10])
    expect(bytes.readUInt32BE(16)).toBe(bytes.readUInt32BE(20))
    expect(bytes[25]).toBe(6)
  })
})

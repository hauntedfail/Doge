import { describe, expect, it } from 'vitest'
import { ACTION_MENU_BACKGROUND_TILES, ACTION_MENU_BOUNDS } from './action-menu-layout.js'

describe('action menu layout', () => {
  it('uses nearly the full display height so all six standard actions remain visible', () => {
    expect(ACTION_MENU_BOUNDS).toEqual({ x: 296, y: 8, width: 272, height: 272 })
  })

  it('covers the menu with two legal G2 image containers', () => {
    expect(ACTION_MENU_BACKGROUND_TILES).toEqual([
      { x: 296, y: 8, width: 272, height: 144 },
      { x: 296, y: 152, width: 272, height: 128 },
    ])
    expect(
      ACTION_MENU_BACKGROUND_TILES.every((tile) => tile.width <= 288 && tile.height <= 144),
    ).toBe(true)
  })
})

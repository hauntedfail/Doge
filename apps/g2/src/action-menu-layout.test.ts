import { describe, expect, it } from 'vitest'
import { ACTION_MENU_BACKGROUND_TILES, ACTION_MENU_BOUNDS } from './action-menu-layout.js'

describe('action menu layout', () => {
  it('uses the full display height so all seven actions including Reload remain reachable', () => {
    expect(ACTION_MENU_BOUNDS).toEqual({ x: 288, y: 0, width: 280, height: 288 })
  })

  it('covers the menu with two legal G2 image containers', () => {
    expect(ACTION_MENU_BACKGROUND_TILES).toEqual([
      { x: 288, y: 0, width: 280, height: 144 },
      { x: 288, y: 144, width: 280, height: 144 },
    ])
    expect(
      ACTION_MENU_BACKGROUND_TILES.every((tile) => tile.width <= 288 && tile.height <= 144),
    ).toBe(true)
  })
})

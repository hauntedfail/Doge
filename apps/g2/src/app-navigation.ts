import type { Feed } from '@even-g2-x-reader/contracts'

export type AppLayer = 'view-select' | 'reader'

export const VIEW_OPTIONS: ReadonlyArray<{ label: string; feed: Feed }> = [
  { label: 'Home', feed: 'home' },
  { label: 'Following', feed: 'following' },
  { label: 'Bookmarks', feed: 'bookmarks' },
]

export function feedForViewIndex(index: number): Feed | null {
  return VIEW_OPTIONS[index]?.feed ?? null
}

export function doubleTapDestination(layer: AppLayer): 'view-select' | 'exit' {
  return layer === 'reader' ? 'view-select' : 'exit'
}

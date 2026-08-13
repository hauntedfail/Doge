import type { Feed } from '@even-g2-x-reader/contracts'

export type AppLayer = 'view-select' | 'reader' | 'gallery' | 'profile'
export type ReaderMode = 'timeline' | 'thread'
export type BackDestination = 'close-menu' | 'reader' | 'close-thread' | 'view-select' | 'exit'

export interface BackContext {
  layer: AppLayer
  menuOpen: boolean
  readerMode: ReaderMode
}

export const VIEW_OPTIONS: ReadonlyArray<{ label: string; feed: Feed }> = [
  { label: 'Home', feed: 'home' },
  { label: 'Following', feed: 'following' },
  { label: 'Bookmarks', feed: 'bookmarks' },
]

export function feedForViewIndex(index: number): Feed | null {
  return VIEW_OPTIONS[index]?.feed ?? null
}

export function backDestination(context: BackContext): BackDestination {
  if (context.menuOpen) return 'close-menu'
  if (context.layer === 'gallery' || context.layer === 'profile') return 'reader'
  if (context.layer === 'reader' && context.readerMode === 'thread') return 'close-thread'
  return context.layer === 'reader' ? 'view-select' : 'exit'
}

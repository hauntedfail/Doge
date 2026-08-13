import { describe, expect, it } from 'vitest'
import { VIEW_OPTIONS, doubleTapDestination, feedForViewIndex } from './app-navigation.js'

describe('Doge application navigation', () => {
  it('starts from the three explicit timeline views', () => {
    expect(VIEW_OPTIONS).toEqual([
      { label: 'Home', feed: 'home' },
      { label: 'Following', feed: 'following' },
      { label: 'Bookmarks', feed: 'bookmarks' },
    ])
    expect(feedForViewIndex(0)).toBe('home')
    expect(feedForViewIndex(1)).toBe('following')
    expect(feedForViewIndex(2)).toBe('bookmarks')
    expect(feedForViewIndex(3)).toBeNull()
  })

  it('returns from a reader view before allowing exit at the selector', () => {
    expect(doubleTapDestination('reader')).toBe('view-select')
    expect(doubleTapDestination('view-select')).toBe('exit')
  })
})

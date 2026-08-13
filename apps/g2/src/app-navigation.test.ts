import { describe, expect, it } from 'vitest'
import { VIEW_OPTIONS, backDestination, feedForViewIndex } from './app-navigation.js'

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

  it('applies the shared back hierarchy from transient UI to app exit', () => {
    expect(backDestination({ layer: 'reader', menuOpen: true, readerMode: 'thread' })).toBe(
      'close-menu',
    )
    expect(backDestination({ layer: 'gallery', menuOpen: false, readerMode: 'thread' })).toBe(
      'reader',
    )
    expect(backDestination({ layer: 'reader', menuOpen: false, readerMode: 'thread' })).toBe(
      'close-thread',
    )
    expect(backDestination({ layer: 'reader', menuOpen: false, readerMode: 'timeline' })).toBe(
      'view-select',
    )
    expect(backDestination({ layer: 'view-select', menuOpen: false, readerMode: 'timeline' })).toBe(
      'exit',
    )
  })
})

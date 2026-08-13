import { describe, expect, it } from 'vitest'
import type { Post } from '@even-g2-x-reader/contracts'
import { reactionMenuItems, reactionSelection } from './reaction-menu.js'

const post = {
  id: '42',
  authorName: 'Ada',
  authorHandle: 'ada',
  authorAvatarUrl: null,
  text: 'Hello',
  createdAt: '',
  replyCount: 0,
  repostCount: 1,
  likeCount: 2,
  viewCount: null,
  bookmarkCount: 0,
  images: [],
  viewerHasLiked: true,
  viewerHasReposted: false,
  viewerHasBookmarked: true,
} satisfies Post

describe('reaction menu', () => {
  it('labels toggles from the viewer reaction state', () => {
    expect(reactionMenuItems(post)).toEqual([
      'Unlike',
      'Repost',
      'Remove bookmark',
      'Open thread',
      'Close',
    ])
  })

  it('maps selection to explicit desired state', () => {
    expect(reactionSelection(post, 0)).toEqual({ reaction: 'like', active: false })
    expect(reactionSelection(post, 1)).toEqual({ reaction: 'repost', active: true })
    expect(reactionSelection(post, 2)).toEqual({ reaction: 'bookmark', active: false })
    expect(reactionSelection(post, 3)).toBe('thread')
    expect(reactionSelection(post, 4)).toBe('close')
    expect(reactionSelection(post, 5)).toBeNull()
  })
})

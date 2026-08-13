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

const postWithImages = {
  ...post,
  images: [
    {
      kind: 'video_thumbnail' as const,
      url: 'https://pbs.twimg.com/media/GalleryPoster?format=jpg&name=small',
      width: 1920,
      height: 1080,
    },
  ],
} satisfies Post

describe('reaction menu', () => {
  it('labels toggles from the viewer reaction state', () => {
    expect(reactionMenuItems(post)).toEqual([
      'Unlike',
      'Repost',
      'Remove bookmark',
      'Reload',
      'Open thread',
      'Profile',
      'Close',
    ])
  })

  it('maps selection to explicit desired state', () => {
    expect(reactionSelection(post, 0)).toEqual({ reaction: 'like', active: false })
    expect(reactionSelection(post, 1)).toEqual({ reaction: 'repost', active: true })
    expect(reactionSelection(post, 2)).toEqual({ reaction: 'bookmark', active: false })
    expect(reactionSelection(post, 3)).toBe('reload')
    expect(reactionSelection(post, 4)).toBe('thread')
    expect(reactionSelection(post, 5)).toBe('profile')
    expect(reactionSelection(post, 6)).toBe('close')
    expect(reactionSelection(post, 7)).toBeNull()
  })

  it('offers Gallery only when the post contains visual media', () => {
    expect(reactionMenuItems(postWithImages)).toEqual([
      'Unlike',
      'Repost',
      'Remove bookmark',
      'Gallery',
      'Reload',
      'Open thread',
      'Profile',
      'Close',
    ])
    expect(reactionSelection(postWithImages, 3)).toBe('gallery')
    expect(reactionSelection(postWithImages, 4)).toBe('reload')
    expect(reactionSelection(postWithImages, 5)).toBe('thread')
    expect(reactionSelection(postWithImages, 6)).toBe('profile')
    expect(reactionSelection(postWithImages, 7)).toBe('close')
  })
})

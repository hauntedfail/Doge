import type { Post, Reaction } from '@even-g2-x-reader/contracts'

export type ReactionMenuSelection =
  { reaction: Reaction; active: boolean } | 'gallery' | 'reload' | 'thread' | 'close' | null

export function reactionMenuItems(post: Post): string[] {
  return [
    post.viewerHasLiked ? 'Unlike' : 'Like',
    post.viewerHasReposted ? 'Undo repost' : 'Repost',
    post.viewerHasBookmarked ? 'Remove bookmark' : 'Bookmark',
    ...(post.images.length > 0 ? ['Gallery'] : []),
    'Reload',
    'Open thread',
    'Close',
  ]
}

export function reactionSelection(post: Post, index: number): ReactionMenuSelection {
  if (index === 0) return { reaction: 'like', active: !post.viewerHasLiked }
  if (index === 1) return { reaction: 'repost', active: !post.viewerHasReposted }
  if (index === 2) return { reaction: 'bookmark', active: !post.viewerHasBookmarked }
  if (post.images.length > 0 && index === 3) return 'gallery'
  const reloadIndex = post.images.length > 0 ? 4 : 3
  if (index === reloadIndex) return 'reload'
  const threadIndex = reloadIndex + 1
  if (index === threadIndex) return 'thread'
  if (index === threadIndex + 1) return 'close'
  return null
}

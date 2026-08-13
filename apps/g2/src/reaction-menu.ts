import type { Post, Reaction } from '@even-g2-x-reader/contracts'

export type ReactionMenuSelection =
  { reaction: Reaction; active: boolean } | 'thread' | 'close' | null

export function reactionMenuItems(post: Post): string[] {
  return [
    post.viewerHasLiked ? 'Unlike' : 'Like',
    post.viewerHasReposted ? 'Undo repost' : 'Repost',
    post.viewerHasBookmarked ? 'Remove bookmark' : 'Bookmark',
    'Open thread',
    'Close',
  ]
}

export function reactionSelection(post: Post, index: number): ReactionMenuSelection {
  if (index === 0) return { reaction: 'like', active: !post.viewerHasLiked }
  if (index === 1) return { reaction: 'repost', active: !post.viewerHasReposted }
  if (index === 2) return { reaction: 'bookmark', active: !post.viewerHasBookmarked }
  if (index === 3) return 'thread'
  if (index === 4) return 'close'
  return null
}

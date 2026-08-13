import type { Feed, Post, Thread, TimelinePage } from '@even-g2-x-reader/contracts'
import type { TimelineSource } from './source.js'

const feedText: Record<Feed, string[]> = {
  home: [
    'Even G2 reader is running in mock mode. Swipe up for the next post.',
    'The X Safe Relay stays on localhost. Only this read-only gateway may be exposed later.',
    'Tap the right glasses touchpad to open a thread. Double-tap to exit.',
    'A ring tap cycles Home, Following, and Bookmarks.',
  ],
  following: [
    'Following feed: this deterministic sample works without an X session.',
    'Once the relay catalog is synced, switch X_SOURCE to relay for live data.',
  ],
  bookmarks: [
    'Bookmarks feed: gateway responses are normalised before reaching the glasses.',
    'No like, repost, follow, or post endpoint exists in this application.',
  ],
}

function postsFor(feed: Feed): Post[] {
  const baseId: Record<Feed, number> = { home: 1000, following: 2000, bookmarks: 3000 }
  return feedText[feed].map((text, index) => ({
    id: String(baseId[feed] + index + 1),
    authorName: index === 0 ? 'G2 Reader' : 'Safe Relay',
    authorHandle: index === 0 ? 'g2_reader' : 'local_gateway',
    authorAvatarUrl: null,
    text,
    createdAt: new Date(Date.UTC(2026, 7, 12, index, 0, 0)).toISOString(),
    replyCount: index,
    repostCount: index * 2,
    likeCount: index * 3,
    viewCount: (index + 1) * 100,
    images: [],
  }))
}

export class MockTimelineSource implements TimelineSource {
  async list(feed: Feed, cursor?: string): Promise<TimelinePage> {
    const offset = cursor === 'page-2' ? 2 : 0
    const all = postsFor(feed)
    const posts = all.slice(offset, offset + 2)
    const nextCursor = offset + posts.length < all.length ? 'page-2' : null
    return { feed, posts, nextCursor }
  }

  async thread(postId: string): Promise<Thread> {
    const all = (Object.keys(feedText) as Feed[]).flatMap(postsFor)
    const root = all.find((post) => post.id === postId) ?? all[0]
    if (!root) return { rootId: postId, posts: [] }
    return {
      rootId: postId,
      posts: [
        root,
        {
          ...root,
          id: `${postId}-reply`,
          authorName: 'Thread Reply',
          authorHandle: 'reply',
          text: 'This is a mock reply. Tap again to return to the feed.',
          likeCount: 1,
        },
      ],
    }
  }
}

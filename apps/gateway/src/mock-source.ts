import type {
  Feed,
  Post,
  ProfilePage,
  Reaction,
  ReactionResult,
  Thread,
  TimelinePage,
} from '@even-g2-x-reader/contracts'
import type { TimelineSource } from './source.js'

const feedText: Record<Feed, string[]> = {
  home: [
    'Doge is running in mock mode with deterministic timeline data.',
    'The X Safe Relay stays on localhost. Doge exposes only scoped gateway routes.',
    'Viewer reaction state is reflected in the Like, Repost, and Bookmark icons.',
    'Home, Following, and Bookmarks use separate scoped timeline requests.',
  ],
  following: [
    'Following feed: this deterministic sample works without an X session.',
    'Once the relay catalog is synced, switch X_SOURCE to relay for live data.',
  ],
  bookmarks: [
    'Bookmarks feed: gateway responses are normalised before reaching the glasses.',
    'Doge supports Like, Repost, and Bookmark, but not follow or posting.',
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
    bookmarkCount: index,
    images: [],
    viewerHasLiked: false,
    viewerHasReposted: false,
    viewerHasBookmarked: false,
  }))
}

export class MockTimelineSource implements TimelineSource {
  readonly #reactions = new Map<string, Partial<Record<Reaction, boolean>>>()

  #withViewerState(post: Post): Post {
    const reactions = this.#reactions.get(post.id)
    if (!reactions) return post
    return {
      ...post,
      viewerHasLiked: reactions.like ?? post.viewerHasLiked,
      viewerHasReposted: reactions.repost ?? post.viewerHasReposted,
      viewerHasBookmarked: reactions.bookmark ?? post.viewerHasBookmarked,
    }
  }

  async list(feed: Feed, cursor?: string): Promise<TimelinePage> {
    const offset = cursor === 'page-2' ? 2 : 0
    const all = postsFor(feed)
    const posts = all.slice(offset, offset + 2).map((post) => this.#withViewerState(post))
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
        this.#withViewerState(root),
        {
          ...root,
          id: String(Number(postId) + 9_000_000_000_000),
          authorName: 'Thread Reply',
          authorHandle: 'reply',
          text: 'This is a deterministic mock reply returned by the scoped thread route.',
          likeCount: 1,
        },
      ],
    }
  }

  async profile(handle: string, cursor?: string): Promise<ProfilePage> {
    const matching = (Object.keys(feedText) as Feed[])
      .flatMap(postsFor)
      .filter((post) => post.authorHandle.toLowerCase() === handle.toLowerCase())
    const fallback = postsFor('home')[0]
    const posts = matching.length > 0 ? matching : fallback ? [fallback] : []
    const first = posts[0]
    const offset = cursor === 'profile-page-2' ? 2 : 0
    const pagePosts = posts.slice(offset, offset + 2).map((post) => this.#withViewerState(post))
    return {
      profile: {
        id: first?.id ?? '0',
        name: first?.authorName ?? handle,
        handle: first?.authorHandle ?? handle,
        avatarUrl: first?.authorAvatarUrl ?? null,
        bio: 'Deterministic mock profile for Doge development.',
        location: '',
        followerCount: 42,
        followingCount: 7,
        postCount: posts.length,
        verified: false,
      },
      posts: pagePosts,
      nextCursor: offset + pagePosts.length < posts.length ? 'profile-page-2' : null,
    }
  }

  async setReaction(postId: string, reaction: Reaction, active: boolean): Promise<ReactionResult> {
    this.#reactions.set(postId, { ...this.#reactions.get(postId), [reaction]: active })
    return { postId, reaction, active }
  }
}

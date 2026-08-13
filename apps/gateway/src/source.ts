import type {
  Feed,
  ProfilePage,
  Reaction,
  ReactionResult,
  Thread,
  TimelinePage,
} from '@even-g2-x-reader/contracts'

export interface TimelineSource {
  list(feed: Feed, cursor?: string, seenTweetIds?: string[]): Promise<TimelinePage>
  thread(postId: string): Promise<Thread>
  profile(handle: string, cursor?: string): Promise<ProfilePage>
  setReaction(postId: string, reaction: Reaction, active: boolean): Promise<ReactionResult>
}

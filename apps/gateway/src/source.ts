import type { Feed, Thread, TimelinePage } from '@even-g2-x-reader/contracts'

export interface TimelineSource {
  list(feed: Feed, cursor?: string): Promise<TimelinePage>
  thread(postId: string): Promise<Thread>
}

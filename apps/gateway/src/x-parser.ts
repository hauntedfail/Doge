import type { Feed, Post, Thread, TimelinePage } from '@even-g2-x-reader/contracts'

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function walk(value: unknown, visit: (object: JsonObject) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit)
    return
  }
  if (!isObject(value)) return
  visit(value)
  for (const child of Object.values(value)) walk(child, visit)
}

function objectAt(object: JsonObject, ...path: string[]): JsonObject | undefined {
  let current: unknown = object
  for (const key of path) {
    if (!isObject(current)) return undefined
    current = current[key]
  }
  return isObject(current) ? current : undefined
}

function stringAt(object: JsonObject | undefined, key: string): string | undefined {
  const value = object?.[key]
  return typeof value === 'string' ? value : undefined
}

function countAt(object: JsonObject | undefined, key: string): number {
  const value = object?.[key]
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.trunc(value))
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return 0
}

function normaliseDate(value: string | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.valueOf()) ? value : date.toISOString()
}

function postFromObject(candidate: JsonObject): Post | undefined {
  const id = stringAt(candidate, 'rest_id')
  const legacy = objectAt(candidate, 'legacy')
  if (!id || !legacy || typeof legacy.full_text !== 'string') return undefined

  const user = objectAt(candidate, 'core', 'user_results', 'result')
  const userCore = user ? objectAt(user, 'core') : undefined
  const userLegacy = user ? objectAt(user, 'legacy') : undefined
  const note = objectAt(candidate, 'note_tweet', 'note_tweet_results', 'result')
  const views = objectAt(candidate, 'views')
  const text = stringAt(note, 'text') ?? stringAt(legacy, 'full_text') ?? ''

  return {
    id,
    authorName: stringAt(userCore, 'name') ?? stringAt(userLegacy, 'name') ?? 'Unknown',
    authorHandle:
      stringAt(userCore, 'screen_name') ?? stringAt(userLegacy, 'screen_name') ?? 'unknown',
    text,
    createdAt: normaliseDate(stringAt(legacy, 'created_at')),
    replyCount: countAt(legacy, 'reply_count'),
    repostCount: countAt(legacy, 'retweet_count'),
    likeCount: countAt(legacy, 'favorite_count'),
    viewCount: views?.count === undefined ? null : countAt(views, 'count'),
  }
}

function assertNoGraphQlErrors(raw: unknown): void {
  if (!isObject(raw) || !Array.isArray(raw.errors) || raw.errors.length === 0) return
  const messages = raw.errors.map((error) => {
    return isObject(error) && typeof error.message === 'string'
      ? error.message
      : 'unknown GraphQL error'
  })
  throw new Error(`X GraphQL error: ${messages.join('; ')}`)
}

function collectPosts(raw: unknown): Post[] {
  const posts = new Map<string, Post>()
  walk(raw, (object) => {
    const result = objectAt(object, 'tweet_results', 'result')
    const candidate = result ? (objectAt(result, 'tweet') ?? result) : undefined
    const post = candidate ? postFromObject(candidate) : undefined
    if (post && !posts.has(post.id)) posts.set(post.id, post)
  })
  return [...posts.values()]
}

function bottomCursor(raw: unknown): string | null {
  let cursor: string | null = null
  walk(raw, (object) => {
    if (cursor === null && object.cursorType === 'Bottom' && typeof object.value === 'string') {
      cursor = object.value
    }
  })
  return cursor
}

export function parseTimeline(raw: unknown, feed: Feed): TimelinePage {
  assertNoGraphQlErrors(raw)
  return { feed, posts: collectPosts(raw), nextCursor: bottomCursor(raw) }
}

export function parseThread(raw: unknown, rootId: string): Thread {
  assertNoGraphQlErrors(raw)
  const posts = collectPosts(raw)
  const rootIndex = posts.findIndex((post) => post.id === rootId)
  if (rootIndex > 0) {
    const root = posts[rootIndex]
    if (root) posts.splice(rootIndex, 1)
    if (root) posts.unshift(root)
  }
  return { rootId, posts }
}

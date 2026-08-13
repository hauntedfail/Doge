import type {
  Feed,
  Post,
  ProfilePage,
  Thread,
  TimelinePage,
  UserProfile,
} from '@even-g2-x-reader/contracts'
import { parseAvatarUrl } from './avatar.js'
import { parseMediaUrl } from './media.js'

type JsonObject = Record<string, unknown>

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function walk(value: unknown, visit: (object: JsonObject) => boolean | void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit)
    return
  }
  if (!isObject(value)) return
  if (visit(value) === false) return
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

function booleanAt(object: JsonObject | undefined, key: string): boolean {
  return object?.[key] === true
}

function positiveIntegerAt(object: JsonObject | undefined, key: string): number | null {
  const value = object?.[key]
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 32_768
    ? value
    : null
}

function imagesAt(legacy: JsonObject): Post['images'] {
  const media = objectAt(legacy, 'extended_entities')?.media
  if (!Array.isArray(media)) return []
  const images: Post['images'] = []
  const seen = new Set<string>()
  for (const item of media) {
    if (!isObject(item)) continue
    const kind =
      item.type === 'photo'
        ? 'photo'
        : item.type === 'video'
          ? 'video_thumbnail'
          : item.type === 'animated_gif'
            ? 'animated_gif_thumbnail'
            : null
    if (!kind) continue
    const url = parseMediaUrl(stringAt(item, 'media_url_https'))
    if (!url || seen.has(url.href)) continue
    const original = objectAt(item, 'original_info')
    seen.add(url.href)
    images.push({
      kind,
      url: url.href,
      width: positiveIntegerAt(original, 'width'),
      height: positiveIntegerAt(original, 'height'),
    })
    if (images.length === 4) break
  }
  return images
}

function textWithoutMediaTokens(text: string, legacy: JsonObject): string {
  const media = objectAt(legacy, 'extended_entities')?.media
  if (!Array.isArray(media)) return text

  let visibleText = text
  for (const item of media) {
    if (!isObject(item)) continue
    const token = stringAt(item, 'url')
    if (token) visibleText = visibleText.split(token).join('')
  }
  return visibleText
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+(?=\r?\n|$)/g, '')
    .trim()
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
  const userAvatar = user ? objectAt(user, 'avatar') : undefined
  const note = objectAt(candidate, 'note_tweet', 'note_tweet_results', 'result')
  const views = objectAt(candidate, 'views')
  const text = textWithoutMediaTokens(
    stringAt(note, 'text') ?? stringAt(legacy, 'full_text') ?? '',
    legacy,
  )

  return {
    id,
    authorName: stringAt(userCore, 'name') ?? stringAt(userLegacy, 'name') ?? 'Unknown',
    authorHandle:
      stringAt(userCore, 'screen_name') ?? stringAt(userLegacy, 'screen_name') ?? 'unknown',
    authorAvatarUrl:
      parseAvatarUrl(
        stringAt(userAvatar, 'image_url') ?? stringAt(userLegacy, 'profile_image_url_https'),
      )?.href ?? null,
    text,
    createdAt: normaliseDate(stringAt(legacy, 'created_at')),
    replyCount: countAt(legacy, 'reply_count'),
    repostCount: countAt(legacy, 'retweet_count'),
    likeCount: countAt(legacy, 'favorite_count'),
    viewCount: views?.count === undefined ? null : countAt(views, 'count'),
    bookmarkCount: legacy.bookmark_count === undefined ? null : countAt(legacy, 'bookmark_count'),
    images: imagesAt(legacy),
    viewerHasLiked: booleanAt(legacy, 'favorited'),
    viewerHasReposted: booleanAt(legacy, 'retweeted'),
    viewerHasBookmarked: booleanAt(legacy, 'bookmarked'),
  }
}

export function assertNoGraphQlErrors(raw: unknown): void {
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
    // X attaches this object to promoted timeline items even when the request
    // asks for includePromotedContent=false. Skip the complete entry subtree.
    if (isObject(object.promotedMetadata)) return false
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

export function parseUserProfile(raw: unknown): UserProfile {
  assertNoGraphQlErrors(raw)
  const root = isObject(raw) ? raw : undefined
  const user = root ? objectAt(root, 'data', 'user', 'result') : undefined
  const id = stringAt(user, 'rest_id')
  const core = objectAt(user ?? {}, 'core')
  const legacy = objectAt(user ?? {}, 'legacy')
  const avatar = objectAt(user ?? {}, 'avatar')
  const verification = objectAt(user ?? {}, 'verification')
  const name = stringAt(core, 'name') ?? stringAt(legacy, 'name')
  const handle = stringAt(core, 'screen_name') ?? stringAt(legacy, 'screen_name')
  if (!id || !name || !handle || !/^[A-Za-z0-9_]{1,15}$/u.test(handle)) {
    throw new Error('X profile response is missing identity')
  }
  return {
    id,
    name,
    handle,
    avatarUrl:
      parseAvatarUrl(stringAt(avatar, 'image_url') ?? stringAt(legacy, 'profile_image_url_https'))
        ?.href ?? null,
    bio: stringAt(legacy, 'description') ?? '',
    location: stringAt(legacy, 'location') ?? '',
    followerCount: countAt(legacy, 'followers_count'),
    followingCount: countAt(legacy, 'friends_count'),
    postCount: countAt(legacy, 'statuses_count'),
    verified:
      booleanAt(user, 'is_blue_verified') ||
      booleanAt(legacy, 'verified') ||
      booleanAt(verification, 'verified'),
  }
}

export function parseProfileTimeline(raw: unknown): Pick<ProfilePage, 'posts' | 'nextCursor'> {
  assertNoGraphQlErrors(raw)
  return { posts: collectPosts(raw), nextCursor: bottomCursor(raw) }
}

import {
  reactionResultSchema,
  profilePageSchema,
  threadSchema,
  timelinePageSchema,
  type Feed,
  type Reaction,
  type ReactionResult,
  type ProfilePage,
  type Thread,
  type TimelinePage,
} from '@even-g2-x-reader/contracts'
import { browserAccessToken } from './auth.js'

export type DataLoadStage = 'downloading' | 'preparing'
export type DataLoadProgress = (stage: DataLoadStage) => void | Promise<void>
export type ImageDataLoadStage = 'downloading' | 'downloaded'
export type ImageDataLoadProgress = (stage: ImageDataLoadStage) => void | Promise<void>

function apiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/u, '')
  return window.location.port === '5173' ? 'http://127.0.0.1:8787' : window.location.origin
}

function authorisedHeaders(accept: string): Headers {
  const headers = new Headers({ accept })
  const accessToken = browserAccessToken()
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`)
  return headers
}

async function get(path: string, onProgress?: DataLoadProgress): Promise<unknown> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: 'GET',
    credentials: 'omit',
    headers: authorisedHeaders('application/json'),
  })
  await onProgress?.('downloading')
  const json = (await response.json()) as unknown
  if (response.status === 401) throw new Error('Access key required on this iPhone')
  if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}`)
  await onProgress?.('preparing')
  return json
}

export async function loadAvatarImage(url: string): Promise<Uint8Array> {
  const query = new URLSearchParams({ url })
  const response = await fetch(`${apiBase()}/api/v1/avatar?${query}`, {
    method: 'GET',
    credentials: 'omit',
    headers: authorisedHeaders('image/jpeg,image/png,image/webp'),
  })
  if (response.status === 401) throw new Error('Access key required on this iPhone')
  if (!response.ok) throw new Error(`Avatar gateway returned HTTP ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

export async function loadPostImage(
  url: string,
  onProgress?: ImageDataLoadProgress,
): Promise<Blob> {
  const query = new URLSearchParams({ url })
  const response = await fetch(`${apiBase()}/api/v1/media?${query}`, {
    method: 'GET',
    credentials: 'omit',
    headers: authorisedHeaders('image/jpeg,image/png,image/webp'),
  })
  await onProgress?.('downloading')
  if (response.status === 401) throw new Error('Access key required on this iPhone')
  if (!response.ok) throw new Error(`Media gateway returned HTTP ${response.status}`)
  const image = await response.blob()
  await onProgress?.('downloaded')
  return image
}

export async function loadTimeline(
  feed: Feed,
  cursor?: string,
  onProgress?: DataLoadProgress,
  viewedPostIds: readonly string[] = [],
): Promise<TimelinePage> {
  const query = new URLSearchParams({ feed })
  if (cursor) query.set('cursor', cursor)
  const seen = [...new Set(viewedPostIds.filter((id) => /^\d{1,24}$/u.test(id)))].slice(-200)
  if (seen.length > 0) query.set('seen', seen.join(','))
  return timelinePageSchema.parse(await get(`/api/v1/timeline?${query}`, onProgress))
}

export async function loadThread(postId: string, onProgress?: DataLoadProgress): Promise<Thread> {
  if (!/^\d{1,24}$/u.test(postId)) {
    throw new Error('Invalid post ID')
  }
  return threadSchema.parse(
    await get(`/api/v1/posts/${encodeURIComponent(postId)}/thread`, onProgress),
  )
}

export async function loadProfile(
  handle: string,
  cursor?: string,
  onProgress?: DataLoadProgress,
): Promise<ProfilePage> {
  if (!/^[A-Za-z0-9_]{1,15}$/u.test(handle)) throw new Error('Invalid X handle')
  const query = new URLSearchParams()
  if (cursor) query.set('cursor', cursor)
  const suffix = query.size > 0 ? `?${query}` : ''
  return profilePageSchema.parse(
    await get(`/api/v1/users/${encodeURIComponent(handle)}/profile${suffix}`, onProgress),
  )
}

export async function setReaction(
  postId: string,
  reaction: Reaction,
  active: boolean,
): Promise<ReactionResult> {
  if (!/^\d{1,24}$/u.test(postId)) throw new Error('Invalid post ID')
  const headers = authorisedHeaders('application/json')
  headers.set('content-type', 'application/json')
  const response = await fetch(
    `${apiBase()}/api/v1/posts/${encodeURIComponent(postId)}/reactions/${reaction}`,
    {
      method: active ? 'PUT' : 'DELETE',
      credentials: 'omit',
      headers,
    },
  )
  const json = (await response.json()) as unknown
  if (response.status === 401) throw new Error('Access key required on this iPhone')
  if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}`)
  return reactionResultSchema.parse(json)
}

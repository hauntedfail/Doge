import {
  threadSchema,
  timelinePageSchema,
  type Feed,
  type Thread,
  type TimelinePage,
} from '@even-g2-x-reader/contracts'
import { browserAccessToken } from './auth.js'

function apiBase(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim()
  if (configured) return configured.replace(/\/$/u, '')
  return window.location.port === '5173' ? 'http://127.0.0.1:8787' : window.location.origin
}

async function get(path: string): Promise<unknown> {
  const headers = new Headers({ accept: 'application/json' })
  const accessToken = browserAccessToken()
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`)
  const response = await fetch(`${apiBase()}${path}`, {
    method: 'GET',
    credentials: 'omit',
    headers,
  })
  const json = (await response.json()) as unknown
  if (response.status === 401) throw new Error('Access key required on this iPhone')
  if (!response.ok) throw new Error(`Gateway returned HTTP ${response.status}`)
  return json
}

export async function loadTimeline(feed: Feed, cursor?: string): Promise<TimelinePage> {
  const query = new URLSearchParams({ feed })
  if (cursor) query.set('cursor', cursor)
  return timelinePageSchema.parse(await get(`/api/v1/timeline?${query}`))
}

export async function loadThread(postId: string): Promise<Thread> {
  if (!/^\d{1,24}$/u.test(postId)) {
    throw new Error('Invalid post ID')
  }
  return threadSchema.parse(await get(`/api/v1/posts/${encodeURIComponent(postId)}/thread`))
}

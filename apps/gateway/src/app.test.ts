import { describe, expect, it, vi } from 'vitest'
import type { TimelineSource } from './source.js'
import { createApp } from './app.js'

const post = {
  id: '1',
  authorName: 'Ada',
  authorHandle: 'ada',
  text: 'Hello',
  createdAt: '2026-08-12T00:00:00.000Z',
  replyCount: 0,
  repostCount: 0,
  likeCount: 1,
  viewCount: 2,
}

function source(): TimelineSource {
  return {
    list: vi.fn(async (feed) => ({ feed, posts: [post], nextCursor: null })),
    thread: vi.fn(async (id) => ({ rootId: id, posts: [post] })),
  }
}

describe('gateway', () => {
  it('only exposes validated read routes', async () => {
    const app = createApp({ source: source(), bearerToken: undefined, allowedOrigins: [] })
    expect((await app.request('/api/v1/timeline?feed=home')).status).toBe(200)
    expect((await app.request('/api/v1/timeline?feed=likes')).status).toBe(400)
    expect((await app.request('/api/v1/posts/1/thread')).status).toBe(200)
    expect((await app.request('/i/api/graphql/anything', { method: 'POST' })).status).toBe(404)
    expect((await app.request('/api/v1/timeline?feed=home', { method: 'POST' })).status).toBe(404)
  })

  it('enforces bearer auth when configured', async () => {
    const app = createApp({ source: source(), bearerToken: 'secret', allowedOrigins: [] })
    expect((await app.request('/api/v1/timeline?feed=home')).status).toBe(401)
    expect(
      (
        await app.request('/api/v1/timeline?feed=home', {
          headers: { authorization: 'Bearer secret' },
        })
      ).status,
    ).toBe(200)
  })

  it('allows the explicitly configured WebView origin through resource policy', async () => {
    const app = createApp({
      source: source(),
      bearerToken: undefined,
      allowedOrigins: ['http://127.0.0.1:5173'],
    })
    const response = await app.request('/api/v1/timeline?feed=home', {
      headers: { origin: 'http://127.0.0.1:5173' },
    })
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
    expect(response.headers.get('cross-origin-resource-policy')).toBe('cross-origin')
  })

  it('answers an allowed CORS preflight before bearer authentication', async () => {
    const app = createApp({
      source: source(),
      bearerToken: 'secret',
      allowedOrigins: ['http://127.0.0.1:5173'],
    })
    const response = await app.request('/api/v1/timeline?feed=home', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://127.0.0.1:5173',
        'access-control-request-method': 'GET',
      },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
  })

  it('reflects an installed app origin only when bearer CORS is enabled with authentication', async () => {
    const app = createApp({
      source: source(),
      bearerToken: 'secret',
      allowedOrigins: [],
      allowBearerCors: true,
    })
    const response = await app.request('/api/v1/timeline?feed=home', {
      headers: {
        authorization: 'Bearer secret',
        origin: 'capacitor://localhost',
      },
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('capacitor://localhost')

    const preflight = await app.request('/api/v1/timeline?feed=home', {
      method: 'OPTIONS',
      headers: {
        origin: 'capacitor://localhost',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization',
      },
    })
    expect(preflight.status).toBe(204)
    expect(preflight.headers.get('access-control-allow-origin')).toBe('capacitor://localhost')
    expect(preflight.headers.get('access-control-allow-headers')).toContain('Authorization')
  })

  it('refuses bearer CORS without a gateway access key', () => {
    expect(() =>
      createApp({
        source: source(),
        bearerToken: undefined,
        allowedOrigins: [],
        allowBearerCors: true,
      }),
    ).toThrow('allowBearerCors requires bearerToken')
  })
})

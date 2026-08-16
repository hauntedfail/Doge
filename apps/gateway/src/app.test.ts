import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TimelineSource } from './source.js'
import { createApp } from './app.js'

const post = {
  id: '1',
  authorName: 'Ada',
  authorHandle: 'ada',
  authorAvatarUrl: 'https://pbs.twimg.com/profile_images/1/ada_normal.jpg',
  text: 'Hello',
  createdAt: '2026-08-12T00:00:00.000Z',
  replyCount: 0,
  repostCount: 0,
  likeCount: 1,
  viewCount: 2,
  bookmarkCount: 0,
  images: [],
  viewerHasLiked: false,
  viewerHasReposted: false,
  viewerHasBookmarked: false,
}

afterEach(() => vi.unstubAllGlobals())

function source(): TimelineSource {
  return {
    list: vi.fn(async (feed) => ({ feed, posts: [post], nextCursor: null })),
    thread: vi.fn(async (id) => ({ rootId: id, posts: [post] })),
    profile: vi.fn(async (handle) => ({
      profile: {
        id: '42',
        name: 'Ada',
        handle,
        avatarUrl: post.authorAvatarUrl,
        bio: 'Computing pioneer',
        location: 'London',
        followerCount: 100,
        followingCount: 20,
        postCount: 300,
        verified: true,
      },
      posts: [post],
      nextCursor: null,
    })),
    setReaction: vi.fn(async (id, reaction, active) => ({ postId: id, reaction, active })),
  }
}

describe('gateway', () => {
  it('identifies the authenticated Doge Gateway protocol during pairing', async () => {
    const app = createApp({
      source: source(),
      bearerToken: undefined,
      allowedOrigins: [],
    })

    const response = await app.request('/api/v1/session')

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      ok: true,
      protocol: 'doge-gateway',
      apiVersion: 1,
    })
  })

  it('only exposes validated read routes', async () => {
    const timelineSource = source()
    const app = createApp({ source: timelineSource, bearerToken: undefined, allowedOrigins: [] })
    expect((await app.request('/api/v1/timeline?feed=home')).status).toBe(200)
    expect((await app.request('/api/v1/timeline?feed=home&seen=11%2C22')).status).toBe(200)
    expect(timelineSource.list).toHaveBeenLastCalledWith('home', undefined, ['11', '22'])
    expect((await app.request('/api/v1/timeline?feed=home&seen=not-an-id')).status).toBe(400)
    expect((await app.request('/api/v1/timeline?feed=likes')).status).toBe(400)
    expect((await app.request('/api/v1/posts/1/thread')).status).toBe(200)
    expect((await app.request('/api/v1/users/ada/profile')).status).toBe(200)
    expect((await app.request('/api/v1/users/not-valid!/profile')).status).toBe(400)
    expect((await app.request('/api/v1/avatar')).status).toBe(400)
    expect((await app.request('/api/v1/media')).status).toBe(400)
    expect((await app.request('/i/api/graphql/anything', { method: 'POST' })).status).toBe(404)
    expect((await app.request('/api/v1/timeline?feed=home', { method: 'POST' })).status).toBe(404)
  })

  it('exposes only the three explicit reaction resources and validates IDs', async () => {
    const timelineSource = source()
    const app = createApp({ source: timelineSource, bearerToken: 'secret', allowedOrigins: [] })
    const headers = { authorization: 'Bearer secret' }

    expect(
      (
        await app.request('/api/v1/posts/42/reactions/like', {
          method: 'PUT',
          headers,
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await app.request('/api/v1/posts/42/reactions/repost', {
          method: 'DELETE',
          headers,
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await app.request('/api/v1/posts/42/reactions/bookmark', {
          method: 'PUT',
          headers,
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await app.request('/api/v1/posts/42/reactions/follow', {
          method: 'PUT',
          headers,
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await app.request('/api/v1/posts/not-a-post/reactions/like', {
          method: 'PUT',
          headers,
        })
      ).status,
    ).toBe(400)
  })

  it('requires the configured bearer token for reaction writes', async () => {
    const app = createApp({ source: source(), bearerToken: 'secret', allowedOrigins: [] })
    expect(
      (
        await app.request('/api/v1/posts/42/reactions/like', {
          method: 'PUT',
        })
      ).status,
    ).toBe(401)
  })

  it('enforces bearer auth when configured', async () => {
    const app = createApp({
      source: source(),
      bearerToken: 'secret',
      allowedOrigins: [],
    })
    expect((await app.request('/api/v1/timeline?feed=home')).status).toBe(401)
    expect((await app.request('/api/v1/session')).status).toBe(401)
    expect(
      (
        await app.request('/api/v1/timeline?feed=home', {
          headers: { authorization: 'Bearer secret' },
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await app.request('/api/v1/session', {
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
    expect(preflight.headers.get('access-control-allow-methods')).toContain('PUT')
    expect(preflight.headers.get('access-control-allow-methods')).toContain('DELETE')
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

  it('proxies only bounded profile images from pbs.twimg.com', async () => {
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const upstream = vi.fn(
      async () =>
        new Response(image, {
          status: 200,
          headers: { 'content-length': String(image.byteLength), 'content-type': 'image/jpeg' },
        }),
    )
    vi.stubGlobal('fetch', upstream)
    const app = createApp({
      source: source(),
      bearerToken: 'secret',
      allowedOrigins: [],
      allowBearerCors: true,
    })
    const url = encodeURIComponent('https://pbs.twimg.com/profile_images/1/ada_normal.jpg')
    const response = await app.request(`/api/v1/avatar?url=${url}`, {
      headers: {
        authorization: 'Bearer secret',
        origin: 'capacitor://localhost',
      },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('access-control-allow-origin')).toBe('capacitor://localhost')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(image)
    expect(upstream).toHaveBeenCalledWith(
      new URL('https://pbs.twimg.com/profile_images/1/ada_normal.jpg'),
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it('rejects arbitrary avatar hosts without making an upstream request', async () => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    const app = createApp({ source: source(), bearerToken: 'secret', allowedOrigins: [] })
    const url = encodeURIComponent('http://127.0.0.1:6900/health')
    const response = await app.request(`/api/v1/avatar?url=${url}`, {
      headers: { authorization: 'Bearer secret' },
    })

    expect(response.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('does not follow avatar redirects and rejects oversized images', async () => {
    const app = createApp({ source: source(), bearerToken: 'secret', allowedOrigins: [] })
    const url = encodeURIComponent('https://pbs.twimg.com/profile_images/1/ada_normal.jpg')

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'http://127.0.0.1:6900/health' },
          }),
      ),
    )
    expect(
      (
        await app.request(`/api/v1/avatar?url=${url}`, {
          headers: { authorization: 'Bearer secret' },
        })
      ).status,
    ).toBe(502)

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(new Uint8Array([0]), {
            status: 200,
            headers: { 'content-length': '524289', 'content-type': 'image/jpeg' },
          }),
      ),
    )
    expect(
      (
        await app.request(`/api/v1/avatar?url=${url}`, {
          headers: { authorization: 'Bearer secret' },
        })
      ).status,
    ).toBe(502)
  })

  it('proxies only bounded post media from pbs.twimg.com', async () => {
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const upstream = vi.fn(
      async () =>
        new Response(image, {
          status: 200,
          headers: { 'content-length': String(image.byteLength), 'content-type': 'image/jpeg' },
        }),
    )
    vi.stubGlobal('fetch', upstream)
    const app = createApp({ source: source(), bearerToken: 'secret', allowedOrigins: [] })
    const mediaUrl = 'https://pbs.twimg.com/media/Example123?format=jpg&name=small'
    const response = await app.request(`/api/v1/media?url=${encodeURIComponent(mediaUrl)}`, {
      headers: { authorization: 'Bearer secret' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(image)
    expect(upstream).toHaveBeenCalledWith(
      new URL(mediaUrl),
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it.each([
    'https://pbs.twimg.com/ext_tw_video_thumb/42/pu/img/Poster_1.jpg',
    'https://pbs.twimg.com/amplify_video_thumb/42/img/Poster_2.jpg',
    'https://pbs.twimg.com/tweet_video_thumb/Poster_3.jpg',
  ])('proxies an allowlisted X video poster path: %s', async (mediaUrl) => {
    const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const upstream = vi.fn(
      async () =>
        new Response(image, {
          status: 200,
          headers: { 'content-length': String(image.byteLength), 'content-type': 'image/jpeg' },
        }),
    )
    vi.stubGlobal('fetch', upstream)
    const app = createApp({ source: source(), bearerToken: 'secret', allowedOrigins: [] })
    const response = await app.request(`/api/v1/media?url=${encodeURIComponent(mediaUrl)}`, {
      headers: { authorization: 'Bearer secret' },
    })

    expect(response.status).toBe(200)
    expect(upstream).toHaveBeenCalledWith(
      new URL(mediaUrl),
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it.each([
    'https://pbs.twimg.com/ext_tw_video/42/pu/vid/640x360/video.mp4',
    'https://pbs.twimg.com/ext_tw_video_thumb/not-a-number/pu/img/Poster.jpg',
    'https://pbs.twimg.com/amplify_video_thumb/42/../../profile_images/1/avatar.jpg',
  ])('rejects a non-poster media path without fetching it: %s', async (mediaUrl) => {
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    const app = createApp({ source: source(), bearerToken: 'secret', allowedOrigins: [] })
    const response = await app.request(`/api/v1/media?url=${encodeURIComponent(mediaUrl)}`, {
      headers: { authorization: 'Bearer secret' },
    })

    expect(response.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects arbitrary media hosts, redirects, and oversized images', async () => {
    const app = createApp({ source: source(), bearerToken: 'secret', allowedOrigins: [] })
    const unsafe = encodeURIComponent('http://127.0.0.1:6900/health')
    const upstream = vi.fn()
    vi.stubGlobal('fetch', upstream)
    expect(
      (
        await app.request(`/api/v1/media?url=${unsafe}`, {
          headers: { authorization: 'Bearer secret' },
        })
      ).status,
    ).toBe(400)
    expect(upstream).not.toHaveBeenCalled()

    const safe = encodeURIComponent('https://pbs.twimg.com/media/Example123?format=jpg&name=small')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 302, headers: { location: unsafe } })),
    )
    expect(
      (
        await app.request(`/api/v1/media?url=${safe}`, {
          headers: { authorization: 'Bearer secret' },
        })
      ).status,
    ).toBe(502)

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(new Uint8Array([0]), {
            status: 200,
            headers: {
              'content-length': String(4 * 1024 * 1024 + 1),
              'content-type': 'image/jpeg',
            },
          }),
      ),
    )
    expect(
      (
        await app.request(`/api/v1/media?url=${safe}`, {
          headers: { authorization: 'Bearer secret' },
        })
      ).status,
    ).toBe(502)
  })
})

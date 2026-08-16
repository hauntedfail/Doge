import { timingSafeEqual } from 'node:crypto'
import {
  feedSchema,
  gatewaySessionSchema,
  profilePageSchema,
  reactionResultSchema,
  reactionSchema,
} from '@even-g2-x-reader/contracts'
import { Hono, type Context } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import { loadAvatar, parseAvatarUrl } from './avatar.js'
import { loadPostMedia, parseMediaUrl } from './media.js'
import type { TimelineSource } from './source.js'

export interface AppOptions {
  source: TimelineSource
  bearerToken: string | undefined
  allowedOrigins: string[]
  allowBearerCors?: boolean
}

const timelineQuery = z.object({
  feed: feedSchema,
  cursor: z.string().min(1).max(2048).optional(),
  seen: z
    .string()
    .min(1)
    .max(5000)
    .regex(/^\d{1,24}(,\d{1,24})*$/u)
    .optional(),
})
const postId = z.string().regex(/^\d{1,24}$/u)
const userHandle = z.string().regex(/^[A-Za-z0-9_]{1,15}$/u)
const profileQuery = z.object({ cursor: z.string().min(1).max(2048).optional() })

function authorised(header: string | undefined, expected: string): boolean {
  const prefix = 'Bearer '
  if (!header?.startsWith(prefix)) return false
  const actual = Buffer.from(header.slice(prefix.length))
  const wanted = Buffer.from(expected)
  return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}

export function createApp(options: AppOptions): Hono {
  if (options.allowBearerCors && !options.bearerToken) {
    throw new Error('allowBearerCors requires bearerToken')
  }
  const app = new Hono()
  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }))
  app.use('/api/*', async (context, next) => {
    context.header('cache-control', 'private, no-store')
    const origin = context.req.header('origin')
    if (origin && (options.allowedOrigins.includes(origin) || options.allowBearerCors)) {
      context.header('access-control-allow-origin', origin)
      context.header('vary', 'Origin')
      context.header('access-control-allow-methods', 'GET, PUT, DELETE, OPTIONS')
      context.header('access-control-allow-headers', 'Authorization, Content-Type')
    }
    if (context.req.method === 'OPTIONS') return context.body(null, 204)
    if (
      options.bearerToken &&
      !authorised(context.req.header('authorization'), options.bearerToken)
    ) {
      return context.json(
        { error: { code: 'unauthorised', message: 'Authentication required' } },
        401,
      )
    }
    await next()
  })

  app.get('/health', (context) => context.json({ ok: true }))
  app.get('/api/v1/session', (context) =>
    context.json(gatewaySessionSchema.parse({ ok: true, protocol: 'doge-gateway', apiVersion: 1 })),
  )
  app.get('/api/v1/timeline', async (context) => {
    const query = timelineQuery.safeParse(context.req.query())
    if (!query.success) {
      return context.json(
        { error: { code: 'invalid_request', message: 'Invalid feed or cursor' } },
        400,
      )
    }
    const seenTweetIds = query.data.seen ? [...new Set(query.data.seen.split(','))].slice(-200) : []
    return context.json(await options.source.list(query.data.feed, query.data.cursor, seenTweetIds))
  })
  app.get('/api/v1/posts/:id/thread', async (context) => {
    const id = postId.safeParse(context.req.param('id'))
    if (!id.success) {
      return context.json({ error: { code: 'invalid_request', message: 'Invalid post ID' } }, 400)
    }
    return context.json(await options.source.thread(id.data))
  })
  app.get('/api/v1/users/:handle/profile', async (context) => {
    const handle = userHandle.safeParse(context.req.param('handle'))
    const query = profileQuery.safeParse(context.req.query())
    if (!handle.success || !query.success) {
      return context.json(
        { error: { code: 'invalid_request', message: 'Invalid handle or cursor' } },
        400,
      )
    }
    return context.json(
      profilePageSchema.parse(await options.source.profile(handle.data, query.data.cursor)),
    )
  })
  const setReaction = async (context: Context) => {
    const id = postId.safeParse(context.req.param('id'))
    const reaction = reactionSchema.safeParse(context.req.param('reaction'))
    if (!id.success || !reaction.success) {
      return context.json(
        { error: { code: 'invalid_request', message: 'Invalid post ID or reaction' } },
        400,
      )
    }
    const result = await options.source.setReaction(
      id.data,
      reaction.data,
      context.req.method === 'PUT',
    )
    return context.json(reactionResultSchema.parse(result))
  }
  app.put('/api/v1/posts/:id/reactions/:reaction', setReaction)
  app.delete('/api/v1/posts/:id/reactions/:reaction', setReaction)
  app.get('/api/v1/avatar', async (context) => {
    const url = parseAvatarUrl(context.req.query('url'))
    if (!url) {
      return context.json(
        { error: { code: 'invalid_request', message: 'Invalid avatar URL' } },
        400,
      )
    }
    const avatar = await loadAvatar(url)
    const body = new Uint8Array(avatar.bytes.byteLength)
    body.set(avatar.bytes)
    context.header('cache-control', 'private, max-age=3600')
    context.header('content-type', avatar.contentType)
    context.header('x-content-type-options', 'nosniff')
    return context.body(body.buffer)
  })
  app.get('/api/v1/media', async (context) => {
    const url = parseMediaUrl(context.req.query('url'))
    if (!url) {
      return context.json({ error: { code: 'invalid_request', message: 'Invalid media URL' } }, 400)
    }
    const media = await loadPostMedia(url)
    const body = new Uint8Array(media.bytes.byteLength)
    body.set(media.bytes)
    context.header('cache-control', 'private, max-age=3600')
    context.header('content-type', media.contentType)
    context.header('x-content-type-options', 'nosniff')
    return context.body(body.buffer)
  })
  app.onError((error, context) => {
    console.error(error)
    return context.json(
      { error: { code: 'upstream_error', message: 'Unable to load X right now' } },
      502,
    )
  })
  return app
}

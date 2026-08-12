import { timingSafeEqual } from 'node:crypto'
import { feedSchema } from '@even-g2-x-reader/contracts'
import { Hono } from 'hono'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import type { TimelineSource } from './source.js'

export interface AppOptions {
  source: TimelineSource
  bearerToken: string | undefined
  allowedOrigins: string[]
}

const timelineQuery = z.object({
  feed: feedSchema,
  cursor: z.string().min(1).max(2048).optional(),
})
const postId = z.string().regex(/^\d{1,24}$/u)

function authorised(header: string | undefined, expected: string): boolean {
  const prefix = 'Bearer '
  if (!header?.startsWith(prefix)) return false
  const actual = Buffer.from(header.slice(prefix.length))
  const wanted = Buffer.from(expected)
  return actual.length === wanted.length && timingSafeEqual(actual, wanted)
}

export function createApp(options: AppOptions): Hono {
  const app = new Hono()
  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }))
  app.use('/api/*', async (context, next) => {
    context.header('cache-control', 'private, no-store')
    const origin = context.req.header('origin')
    if (origin && options.allowedOrigins.includes(origin)) {
      context.header('access-control-allow-origin', origin)
      context.header('access-control-allow-credentials', 'true')
      context.header('vary', 'Origin')
      context.header('access-control-allow-methods', 'GET, OPTIONS')
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
  app.get('/api/v1/timeline', async (context) => {
    const query = timelineQuery.safeParse(context.req.query())
    if (!query.success) {
      return context.json(
        { error: { code: 'invalid_request', message: 'Invalid feed or cursor' } },
        400,
      )
    }
    return context.json(await options.source.list(query.data.feed, query.data.cursor))
  })
  app.get('/api/v1/posts/:id/thread', async (context) => {
    const id = postId.safeParse(context.req.param('id'))
    if (!id.success) {
      return context.json({ error: { code: 'invalid_request', message: 'Invalid post ID' } }, 400)
    }
    return context.json(await options.source.thread(id.data))
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

import { resolve } from 'node:path'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createApp } from './app.js'
import { MockTimelineSource } from './mock-source.js'
import { RelayTimelineSource } from './relay-source.js'
import type { TimelineSource } from './source.js'

function sourceFromEnvironment(): TimelineSource {
  if ((process.env.X_SOURCE ?? 'mock') === 'mock') return new MockTimelineSource()
  if (process.env.X_SOURCE !== 'relay') throw new Error('X_SOURCE must be mock or relay')
  const baseUrl = process.env.TWITTER_RELAY_BASE_URL ?? 'http://127.0.0.1:6900'
  const catalogPath = process.env.X_RELAY_CATALOG_PATH ?? './var/requests.ndjson'
  return new RelayTimelineSource(baseUrl, resolve(catalogPath))
}

const host = process.env.HOST ?? '127.0.0.1'
const port = Number(process.env.PORT ?? '8787')
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be valid')
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ?? 'http://127.0.0.1:5173,http://localhost:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const app = createApp({
  source: sourceFromEnvironment(),
  bearerToken: process.env.GATEWAY_BEARER_TOKEN || undefined,
  allowedOrigins,
})

const staticDir = resolve(process.env.STATIC_DIR ?? 'apps/g2/dist')
app.use('/*', serveStatic({ root: staticDir }))

const fetch =
  process.env.DEBUG_REQUESTS === '1'
    ? (request: Request) => {
        const url = new URL(request.url)
        console.log(
          JSON.stringify({
            method: request.method,
            path: url.pathname,
            origin: request.headers.get('origin'),
          }),
        )
        return app.fetch(request)
      }
    : app.fetch

serve({ fetch, hostname: host, port }, (info) => {
  console.log(`Even G2 X Reader gateway listening on http://${info.address}:${info.port}`)
})

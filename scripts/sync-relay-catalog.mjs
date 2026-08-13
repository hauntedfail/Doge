import { mkdir, rename, writeFile } from 'node:fs/promises'

const source =
  'https://raw.githubusercontent.com/fa0311/twitter_api_safe_relay_skills/main/skills/twitter-api-relay/requests.ndjson'
const destination = new URL('../var/requests.ndjson', import.meta.url)
const temporary = new URL('../var/requests.ndjson.tmp', import.meta.url)
const required = [
  'HomeTimeline',
  'HomeLatestTimeline',
  'Bookmarks',
  'TweetDetail',
  'FavoriteTweet',
  'UnfavoriteTweet',
  'CreateRetweet',
  'DeleteRetweet',
  'CreateBookmark',
  'DeleteBookmark',
]

const response = await fetch(source, { signal: AbortSignal.timeout(15_000) })
if (!response.ok) throw new Error(`Catalog download failed with HTTP ${response.status}`)
const bytes = new Uint8Array(await response.arrayBuffer())
if (bytes.byteLength === 0 || bytes.byteLength > 2_000_000)
  throw new Error('Catalog size is invalid')
const contents = new TextDecoder().decode(bytes)
const present = new Set()
for (const line of contents.split(/\r?\n/u)) {
  if (!line.trim()) continue
  const entry = JSON.parse(line)
  const operation = typeof entry.path === 'string' ? entry.path.split('/').at(-1) : undefined
  if (required.includes(operation)) present.add(operation)
}
const missing = required.filter((operation) => !present.has(operation))
if (missing.length > 0) throw new Error(`Downloaded catalog is missing: ${missing.join(', ')}`)

await mkdir(new URL('../var/', import.meta.url), { recursive: true, mode: 0o700 })
await writeFile(temporary, bytes, { mode: 0o600 })
await rename(temporary, destination)
console.log(`Saved ${bytes.byteLength} bytes to var/requests.ndjson`)

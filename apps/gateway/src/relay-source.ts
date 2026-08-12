import type { Feed, Thread, TimelinePage } from '@even-g2-x-reader/contracts'
import { loadRelayCatalog, type OperationName, type RelayOperation } from './relay-catalog.js'
import type { TimelineSource } from './source.js'
import { parseThread, parseTimeline } from './x-parser.js'

const MAX_RESPONSE_BYTES = 5_000_000
const operationByFeed: Record<Feed, OperationName> = {
  home: 'HomeTimeline',
  following: 'HomeLatestTimeline',
  bookmarks: 'Bookmarks',
}

function relayBaseUrl(value: string): URL {
  const url = new URL(value)
  const isLoopback =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]'
  if (
    url.protocol !== 'http:' ||
    !isLoopback ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error('TWITTER_RELAY_BASE_URL must be an unauthenticated loopback http URL')
  }
  url.pathname = `${url.pathname.replace(/\/$/u, '')}/`
  return url
}

function cloneOperation(operation: RelayOperation): RelayOperation {
  return structuredClone(operation)
}

function updateVariables(
  operation: RelayOperation,
  cursor: string | undefined,
  postId?: string,
): RelayOperation {
  const copy = cloneOperation(operation)
  if (copy.data) {
    copy.data.variables.count = 20
    copy.data.variables.includePromotedContent = false
    copy.data.variables.seenTweetIds = []
    if (cursor) copy.data.variables.cursor = cursor
    else delete copy.data.variables.cursor
    if (postId) copy.data.variables.focalTweetId = postId
    return copy
  }
  if (!copy.params?.variables) throw new Error(`operation ${copy.path} has no variables`)
  const variables = JSON.parse(copy.params.variables) as Record<string, unknown>
  variables.count = 20
  variables.includePromotedContent = false
  if (cursor) variables.cursor = cursor
  else delete variables.cursor
  if (postId) variables.focalTweetId = postId
  copy.params.variables = JSON.stringify(variables)
  return copy
}

async function readLimited(response: Response): Promise<unknown> {
  const contentLength = Number(response.headers.get('content-length') ?? '0')
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error('relay response exceeds 5 MB')
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MAX_RESPONSE_BYTES) throw new Error('relay response exceeds 5 MB')
  const text = new TextDecoder().decode(bytes)
  if (!response.ok) throw new Error(`relay returned HTTP ${response.status}`)
  return JSON.parse(text) as unknown
}

export class RelayTimelineSource implements TimelineSource {
  readonly #baseUrl: URL
  readonly #catalogPath: string

  constructor(baseUrl: string, catalogPath: string) {
    this.#baseUrl = relayBaseUrl(baseUrl)
    this.#catalogPath = catalogPath
  }

  async #request(name: OperationName, cursor?: string, postId?: string): Promise<unknown> {
    const catalog = await loadRelayCatalog(this.#catalogPath)
    const fromCatalog = catalog.get(name)
    if (!fromCatalog) throw new Error(`relay operation unavailable: ${name}`)
    const operation = updateVariables(fromCatalog, cursor, postId)
    const url = new URL(`i/api${operation.path.replace(/^\//u, '/')}`, this.#baseUrl)
    const headers = new Headers({ 'content-type': 'application/json' })
    const init: RequestInit = {
      method: operation.method,
      headers,
      signal: AbortSignal.timeout(15_000),
    }
    if (operation.method === 'GET') {
      for (const [key, value] of Object.entries(operation.params ?? {}))
        url.searchParams.set(key, value)
    } else {
      if (!operation.data) throw new Error(`POST operation ${name} has no data`)
      init.body = JSON.stringify(operation.data)
    }
    return readLimited(await fetch(url, init))
  }

  async list(feed: Feed, cursor?: string): Promise<TimelinePage> {
    return parseTimeline(await this.#request(operationByFeed[feed], cursor), feed)
  }

  async thread(postId: string): Promise<Thread> {
    return parseThread(await this.#request('TweetDetail', undefined, postId), postId)
  }
}

import type {
  Feed,
  ProfilePage,
  Reaction,
  ReactionResult,
  Thread,
  TimelinePage,
} from '@even-g2-x-reader/contracts'
import { loadRelayCatalog, type OperationName, type RelayOperation } from './relay-catalog.js'
import type { TimelineSource } from './source.js'
import {
  assertNoGraphQlErrors,
  parseProfileTimeline,
  parseThread,
  parseTimeline,
  parseUserProfile,
} from './x-parser.js'

const MAX_RESPONSE_BYTES = 5_000_000
const operationByFeed: Record<Feed, OperationName> = {
  home: 'HomeTimeline',
  following: 'HomeLatestTimeline',
  bookmarks: 'Bookmarks',
}
const mutationByReaction: Record<Reaction, readonly [OperationName, OperationName]> = {
  like: ['FavoriteTweet', 'UnfavoriteTweet'],
  repost: ['CreateRetweet', 'DeleteRetweet'],
  bookmark: ['CreateBookmark', 'DeleteBookmark'],
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

function replaceVariables(
  operation: RelayOperation,
  variables: Record<string, unknown>,
): RelayOperation {
  const copy = cloneOperation(operation)
  if (copy.data) {
    copy.data.variables = variables
    return copy
  }
  if (!copy.params?.variables) throw new Error(`operation ${copy.path} has no variables`)
  copy.params.variables = JSON.stringify(variables)
  return copy
}

function mutationVariables(reaction: Reaction, active: boolean, postId: string) {
  if (reaction === 'repost') {
    return active
      ? { tweet_id: postId, dark_request: false }
      : { source_tweet_id: postId, dark_request: false }
  }
  return { tweet_id: postId }
}

function updateMutationVariables(
  operation: RelayOperation,
  reaction: Reaction,
  active: boolean,
  postId: string,
): RelayOperation {
  const copy = cloneOperation(operation)
  if (copy.method !== 'POST' || !copy.data) {
    throw new Error(`mutation operation ${copy.path} must be POST with data`)
  }
  copy.data.variables = mutationVariables(reaction, active, postId)
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

  async #send(name: OperationName, operation: RelayOperation): Promise<unknown> {
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

  async #request(name: OperationName, cursor?: string, postId?: string): Promise<unknown> {
    const catalog = await loadRelayCatalog(this.#catalogPath)
    const fromCatalog = catalog.get(name)
    if (!fromCatalog) throw new Error(`relay operation unavailable: ${name}`)
    return this.#send(name, updateVariables(fromCatalog, cursor, postId))
  }

  async #requestWithVariables(
    name: OperationName,
    variables: Record<string, unknown>,
  ): Promise<unknown> {
    const catalog = await loadRelayCatalog(this.#catalogPath)
    const fromCatalog = catalog.get(name)
    if (!fromCatalog) throw new Error(`relay operation unavailable: ${name}`)
    return this.#send(name, replaceVariables(fromCatalog, variables))
  }

  async #mutation(
    name: OperationName,
    postId: string,
    reaction: Reaction,
    active: boolean,
  ): Promise<unknown> {
    const catalog = await loadRelayCatalog(this.#catalogPath)
    const fromCatalog = catalog.get(name)
    if (!fromCatalog) throw new Error(`relay operation unavailable: ${name}`)
    const operation = updateMutationVariables(fromCatalog, reaction, active, postId)
    const url = new URL(`i/api${operation.path.replace(/^\//u, '/')}`, this.#baseUrl)
    const raw = await readLimited(
      await fetch(url, {
        method: 'POST',
        headers: new Headers({ 'content-type': 'application/json' }),
        body: JSON.stringify(operation.data),
        signal: AbortSignal.timeout(15_000),
      }),
    )
    assertNoGraphQlErrors(raw)
    return raw
  }

  async list(feed: Feed, cursor?: string): Promise<TimelinePage> {
    return parseTimeline(await this.#request(operationByFeed[feed], cursor), feed)
  }

  async thread(postId: string): Promise<Thread> {
    return parseThread(await this.#request('TweetDetail', undefined, postId), postId)
  }

  async profile(handle: string, cursor?: string): Promise<ProfilePage> {
    if (!/^[A-Za-z0-9_]{1,15}$/u.test(handle)) throw new Error('Invalid X handle')
    const profile = parseUserProfile(
      await this.#requestWithVariables('UserByScreenName', {
        screen_name: handle,
        withGrokTranslatedBio: false,
      }),
    )
    const timeline = parseProfileTimeline(
      await this.#requestWithVariables('UserTweets', {
        userId: profile.id,
        count: 20,
        includePromotedContent: false,
        withQuickPromoteEligibilityTweetFields: false,
        withVoice: true,
        ...(cursor ? { cursor } : {}),
      }),
    )
    return { profile, ...timeline }
  }

  async setReaction(postId: string, reaction: Reaction, active: boolean): Promise<ReactionResult> {
    if (!/^\d{1,24}$/u.test(postId)) throw new Error('Invalid post ID')
    const [activate, deactivate] = mutationByReaction[reaction]
    await this.#mutation(active ? activate : deactivate, postId, reaction, active)
    return { postId, reaction, active }
  }
}

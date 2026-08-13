import { readFile } from 'node:fs/promises'

export const operationNames = [
  'HomeTimeline',
  'HomeLatestTimeline',
  'Bookmarks',
  'TweetDetail',
  'UserByScreenName',
  'UserTweets',
  'FavoriteTweet',
  'UnfavoriteTweet',
  'CreateRetweet',
  'DeleteRetweet',
  'CreateBookmark',
  'DeleteBookmark',
] as const
export type OperationName = (typeof operationNames)[number]

export interface RelayOperation {
  method: 'GET' | 'POST'
  path: string
  headers: Record<string, string>
  params?: Record<string, string>
  data?: {
    variables: Record<string, unknown>
    features?: Record<string, unknown>
    fieldToggles?: Record<string, unknown>
    queryId?: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function operationName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? ''
}

function parseOperation(value: unknown, line: number): RelayOperation {
  if (!isRecord(value)) throw new Error(`relay catalog line ${line} is not an object`)
  if (value.method !== 'GET' && value.method !== 'POST') {
    throw new Error(`relay catalog line ${line} has unsupported method`)
  }
  if (
    typeof value.path !== 'string' ||
    !/^\/graphql\/[A-Za-z0-9_-]+\/[A-Za-z]+$/.test(value.path)
  ) {
    throw new Error(`relay catalog line ${line} has an unsafe path`)
  }
  const name = operationName(value.path)
  if (!operationNames.includes(name as OperationName)) {
    throw new Error(`relay catalog line ${line} is not an allowed operation`)
  }
  const headers = isRecord(value.headers)
    ? Object.fromEntries(
        Object.entries(value.headers).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {}
  const operation: RelayOperation = { method: value.method, path: value.path, headers }
  if (isRecord(value.params)) {
    operation.params = Object.fromEntries(
      Object.entries(value.params).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    )
  }
  if (isRecord(value.data) && isRecord(value.data.variables)) {
    operation.data = {
      variables: value.data.variables,
      ...(isRecord(value.data.features) ? { features: value.data.features } : {}),
      ...(isRecord(value.data.fieldToggles) ? { fieldToggles: value.data.fieldToggles } : {}),
      ...(typeof value.data.queryId === 'string' ? { queryId: value.data.queryId } : {}),
    }
  }
  return operation
}

export async function loadRelayCatalog(path: string): Promise<Map<OperationName, RelayOperation>> {
  const contents = await readFile(path, 'utf8')
  if (Buffer.byteLength(contents) > 2_000_000) throw new Error('relay catalog exceeds 2 MB')
  const selected = new Map<OperationName, RelayOperation>()
  for (const [index, rawLine] of contents.split(/\r?\n/u).entries()) {
    const line = rawLine.trim()
    if (!line) continue
    const parsed = JSON.parse(line) as unknown
    if (!isRecord(parsed) || typeof parsed.path !== 'string') continue
    const name = operationName(parsed.path)
    if (!operationNames.includes(name as OperationName)) continue
    selected.set(name as OperationName, parseOperation(parsed, index + 1))
  }
  const missing = operationNames.filter((name) => !selected.has(name))
  if (missing.length > 0) throw new Error(`relay catalog is missing: ${missing.join(', ')}`)
  return selected
}

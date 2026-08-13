export class LatestRenderEpoch {
  #current = 0

  issue(): number {
    this.#current += 1
    return this.#current
  }

  isCurrent(epoch: number): boolean {
    return epoch === this.#current
  }
}

export type LatestImageResult<T> =
  { status: 'rendered'; value: T } | { status: 'failed'; value: T } | { status: 'stale' }

export async function renderLatestImage<T>({
  load,
  isCurrent,
  draw,
}: {
  load: () => Promise<T>
  isCurrent: () => boolean
  draw: (value: T) => Promise<boolean>
}): Promise<LatestImageResult<T>> {
  const value = await load()
  if (!isCurrent()) return { status: 'stale' }
  const succeeded = await draw(value)
  if (!isCurrent()) return { status: 'stale' }
  return succeeded ? { status: 'rendered', value } : { status: 'failed', value }
}

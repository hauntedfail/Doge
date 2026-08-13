import { describe, expect, it, vi } from 'vitest'
import { LatestRenderEpoch, renderLatestImage } from './latest-image.js'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('latest-only G2 image rendering', () => {
  it('does not draw an avatar that finished loading after a newer render was requested', async () => {
    const epochs = new LatestRenderEpoch()
    const first = epochs.issue()
    const image = deferred<Uint8Array>()
    const draw = vi.fn(async () => true)
    const pending = renderLatestImage({
      load: () => image.promise,
      isCurrent: () => epochs.isCurrent(first),
      draw,
    })

    epochs.issue()
    image.resolve(new Uint8Array([1]))

    await expect(pending).resolves.toMatchObject({ status: 'stale' })
    expect(draw).not.toHaveBeenCalled()
  })

  it('does not commit an avatar if the view changes while the bridge is drawing it', async () => {
    const epochs = new LatestRenderEpoch()
    const current = epochs.issue()
    const bridge = deferred<boolean>()
    const pending = renderLatestImage({
      load: async () => new Uint8Array([2]),
      isCurrent: () => epochs.isCurrent(current),
      draw: () => bridge.promise,
    })

    await Promise.resolve()
    epochs.issue()
    bridge.resolve(true)

    await expect(pending).resolves.toMatchObject({ status: 'stale' })
  })

  it('commits the latest avatar when loading and bridge rendering both succeed', async () => {
    const epochs = new LatestRenderEpoch()
    const current = epochs.issue()
    const bytes = new Uint8Array([3])

    await expect(
      renderLatestImage({
        load: async () => bytes,
        isCurrent: () => epochs.isCurrent(current),
        draw: async (loaded) => loaded === bytes,
      }),
    ).resolves.toEqual({ status: 'rendered', value: bytes })
  })

  it('reports a current bridge failure without treating the avatar as rendered', async () => {
    const epochs = new LatestRenderEpoch()
    const current = epochs.issue()

    await expect(
      renderLatestImage({
        load: async () => new Uint8Array([4]),
        isCurrent: () => epochs.isCurrent(current),
        draw: async () => false,
      }),
    ).resolves.toMatchObject({ status: 'failed' })
  })
})

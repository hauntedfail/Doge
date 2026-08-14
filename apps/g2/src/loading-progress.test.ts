import { describe, expect, it } from 'vitest'
import {
  imageLoadingContent,
  imageLoadingIndicator,
  loadingIndicator,
  type LoadingStage,
} from './loading-progress.js'

describe('loadingIndicator', () => {
  it('shows monotonic milestone progress for observable load stages', () => {
    const stages: LoadingStage[] = ['connecting', 'downloading', 'preparing', 'rendering']
    const indicators = stages.map((stage) =>
      loadingIndicator({ operation: 'initial', stage, target: 'Home' }),
    )

    expect(indicators.map(({ percent }) => percent)).toEqual([15, 45, 75, 90])
    expect(indicators.map(({ percent }) => percent)).toEqual(
      [...indicators.map(({ percent }) => percent)].sort((left, right) => left - right),
    )
    expect(indicators.at(-1)?.text).toContain('Rendering on G2')
  })

  it('distinguishes reload and thread operations without claiming false completion', () => {
    const reload = loadingIndicator({ operation: 'reload', stage: 'downloading', target: 'Home' })
    const thread = loadingIndicator({ operation: 'thread', stage: 'preparing', target: 'Thread' })

    expect(reload.title).toBe('RELOADING HOME')
    expect(reload.progressLine).toContain('45%')
    expect(thread.title).toBe('LOADING THREAD')
    expect(thread.percent).toBeLessThan(100)
  })

  it('tracks image fetch, processing, and each sequential G2 tile transfer', () => {
    const indicators = [
      imageLoadingIndicator({ stage: 'requesting', target: 'Image 2/4' }),
      imageLoadingIndicator({ stage: 'downloading', target: 'Image 2/4' }),
      imageLoadingIndicator({ stage: 'processing', target: 'Image 2/4' }),
      ...([0, 1, 2, 3, 4] as const).map((completedTiles) =>
        imageLoadingIndicator({ stage: 'transferring', completedTiles, target: 'Image 2/4' }),
      ),
    ]

    expect(indicators.map(({ percent }) => percent)).toEqual([10, 30, 50, 55, 65, 75, 85, 95])
    expect(indicators[0]?.title).toBe('LOADING IMAGE 2/4')
    expect(indicators.at(-1)?.label).toBe('Sending image to G2 · 4/4')
    expect(indicators.every(({ percent }) => percent < 100)).toBe(true)
  })

  it('clears a finished image loader with a bridge-safe blank', () => {
    expect(imageLoadingContent(null)).toBe(' ')
    expect(imageLoadingContent({ stage: 'requesting', target: 'Image' })).toContain('LOADING IMAGE')
  })
})

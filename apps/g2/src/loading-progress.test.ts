import { describe, expect, it } from 'vitest'
import { loadingIndicator, type LoadingStage } from './loading-progress.js'

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
})

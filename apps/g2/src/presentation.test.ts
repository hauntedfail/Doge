import { describe, expect, it } from 'vitest'
import { renderGlassesText } from './presentation.js'
import { initialReaderState, reduceReaderState } from './reader-state.js'

describe('renderGlassesText', () => {
  it('fits the startup limit and strips display-hostile control characters', () => {
    const post = {
      id: '1',
      authorName: 'Ada\u0000',
      authorHandle: 'ada',
      text: 'x'.repeat(3000),
      createdAt: '2026-08-12T00:00:00.000Z',
      replyCount: 1,
      repostCount: 2,
      likeCount: 3,
      viewCount: 4,
    }
    const state = reduceReaderState(initialReaderState(), {
      type: 'timeline-loaded',
      posts: [post],
      nextCursor: null,
    })
    const output = renderGlassesText(state)
    expect(output.length).toBeLessThanOrEqual(1000)
    expect(output).not.toContain('\u0000')
    expect(output).toContain('@ada')
  })
})

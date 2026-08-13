import { describe, expect, it } from 'vitest'
import { renderGlassesSections, renderGlassesText } from './presentation.js'
import { initialReaderState, reduceReaderState } from './reader-state.js'

describe('renderGlassesText', () => {
  it('fits the startup limit and strips display-hostile control characters', () => {
    const post = {
      id: '1',
      authorName: 'Ada\u0000',
      authorHandle: 'ada',
      authorAvatarUrl: 'https://pbs.twimg.com/profile_images/1/ada_normal.jpg',
      text: 'x'.repeat(3000),
      createdAt: '2026-08-12T00:00:00.000Z',
      replyCount: 1,
      repostCount: 2,
      likeCount: 3,
      viewCount: 4,
      viewerHasLiked: false,
      viewerHasReposted: false,
      viewerHasBookmarked: false,
      images: [
        {
          kind: 'video_thumbnail' as const,
          url: 'https://pbs.twimg.com/media/Example123?format=jpg&name=small',
          width: 1200,
          height: 800,
        },
      ],
    }
    const state = reduceReaderState(initialReaderState(), {
      type: 'timeline-loaded',
      posts: [post],
      nextCursor: null,
    })
    const output = renderGlassesText(state)
    expect(output.length).toBeLessThanOrEqual(1000)
    expect(output).not.toContain('\u0000')
    expect(output).toContain('DOGE / HOME')
    expect(output).toContain('@ada')
    const sections = renderGlassesSections(state)
    expect(sections).toMatchObject({
      header: expect.stringContaining('DOGE / HOME'),
      author: expect.stringContaining('@ada'),
      avatarUrl: 'https://pbs.twimg.com/profile_images/1/ada_normal.jpg',
      postImageUrl: null,
      metricCounts: {
        reply: '1',
        repost: '2',
        like: '3',
      },
    })
    const finalSections = renderGlassesSections(state, sections.bodyPageCount - 1)
    expect(finalSections.postImageUrl).toBe(
      'https://pbs.twimg.com/media/Example123?format=jpg&name=small',
    )
    expect(finalSections.postImageKind).toBe('video_thumbnail')
    expect(sections.body).not.toMatch(/\b(?:RE|RP|LIKE|VIEW)\b/u)
  })
})

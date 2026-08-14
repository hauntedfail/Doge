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
      bookmarkCount: 5,
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
        {
          kind: 'photo' as const,
          url: 'https://pbs.twimg.com/media/Example456?format=jpg&name=small',
          width: 800,
          height: 1200,
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
    expect(output).not.toContain('DOGE')
    expect(output).not.toContain('HOME')
    expect(output).toContain('@ada')
    const sections = renderGlassesSections(state)
    expect(sections).toMatchObject({
      position: '1/1',
      author: expect.stringContaining('@ada'),
      avatarUrl: 'https://pbs.twimg.com/profile_images/1/ada_normal.jpg',
      postImageUrl: null,
      postImageIndex: null,
      postImageCount: 2,
      metricCounts: {
        reply: '1',
        repost: '2',
        like: '3',
        view: '4',
        bookmark: '5',
      },
    })
    const finalSections = renderGlassesSections(state, sections.bodyPageCount - 1)
    expect(finalSections).toMatchObject({
      postImageUrl: 'https://pbs.twimg.com/media/Example123?format=jpg&name=small',
      postImageKind: 'video_thumbnail',
      postImageIndex: 0,
      postImageCount: 2,
    })
    expect(finalSections.postImages).toEqual(post.images)
    expect(finalSections.body.length).toBeGreaterThan(0)
    expect(sections.bodyPageCount).toBeGreaterThan(2)
    expect(sections.body).not.toMatch(/\b(?:RE|RP|LIKE|VIEW)\b/u)
    expect(sections).not.toHaveProperty('header')
    expect(sections).not.toHaveProperty('help')
    expect(output).not.toMatch(/(?:UP|DOWN|TAP|DOUBLE) (?:next|back|actions|views|exit)/u)
  })

  it('shows staged loading progress without spending the page on control hints', () => {
    const loading = renderGlassesSections(initialReaderState(), 0, {
      operation: 'reload',
      stage: 'downloading',
      target: 'Home',
    })
    const failed = renderGlassesSections({
      ...initialReaderState(),
      status: 'error',
      error: 'offline',
    })

    expect(loading.body).toContain('RELOADING HOME')
    expect(loading.body).toContain('45%')
    expect(loading.body).toContain('Receiving posts')
    expect(failed.body).toBe('Unable to load the timeline.\noffline')
  })
})

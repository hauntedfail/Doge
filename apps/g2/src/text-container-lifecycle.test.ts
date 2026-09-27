import { TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { describe, expect, it } from 'vitest'
import {
  REBUILD_TEXT_CONTENT_MAX_CHARACTERS,
  prepareTextContainersForRebuild,
  textContainersRequiringHydration,
} from './text-container-lifecycle.js'

describe('prepareTextContainersForRebuild', () => {
  it('keeps rebuild payloads within 1000 characters before a 2000-character upgrade', () => {
    const content = 'A'.repeat(999) + '🐕' + 'B'.repeat(999)
    const source = [
      new TextContainerProperty({
        containerID: 3,
        containerName: 'post-body',
        content,
        isEventCapture: 1,
      }),
    ]

    const prepared = prepareTextContainersForRebuild(source)

    expect(prepared[0]).not.toBe(source[0])
    expect(prepared[0]?.content?.length).toBeLessThanOrEqual(REBUILD_TEXT_CONTENT_MAX_CHARACTERS)
    expect(prepared[0]?.content).not.toMatch(/[\uD800-\uDBFF]$/u)
    expect(prepared[0]).toMatchObject({
      containerID: 3,
      containerName: 'post-body',
      isEventCapture: 1,
    })
    expect(source[0]?.content).toBe(content)
  })

  it('reuses containers whose content already fits a rebuild', () => {
    const source = [new TextContainerProperty({ containerID: 1, content: 'short' })]

    expect(prepareTextContainersForRebuild(source)[0]).toBe(source[0])
  })

  it('hydrates only content that was shortened for the rebuild', () => {
    const desired = [
      new TextContainerProperty({ containerID: 1, content: 'short' }),
      new TextContainerProperty({ containerID: 2, content: 'L'.repeat(2000) }),
    ]
    const rebuilt = prepareTextContainersForRebuild(desired)

    expect(textContainersRequiringHydration(desired, rebuilt)).toEqual([desired[1]])
  })
})

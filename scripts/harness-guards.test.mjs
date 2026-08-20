import { describe, expect, it } from 'vitest'
import {
  artifactBoundaryFailures,
  forbiddenTrackedPaths,
  manifestAlignmentFailures,
} from './harness-guards.mjs'

describe('repository harness guards', () => {
  it('reports manifest identity drift with the owning field', () => {
    expect(
      manifestAlignmentFailures(
        { package_id: 'ru.h1ka.g2xreader', version: '0.6.5' },
        { package_id: 'ru.h1ka.g2xreader', version: '0.6.6' },
        ['package_id', 'version'],
      ),
    ).toEqual(['G2 manifests disagree on version'])
  })

  it('rejects tracked generated and sensitive paths without rejecting examples', () => {
    expect(
      forbiddenTrackedPaths([
        '.env.example',
        'apps/g2/app.production.json',
        '.env.local',
        'apps/g2/dist/index.html',
        'apps/g2/doge.ehpk',
        'var/doge-access-key',
      ]),
    ).toEqual(['.env.local', 'apps/g2/dist/index.html', 'apps/g2/doge.ehpk', 'var/doge-access-key'])
  })

  it('detects fixed origins and access keys without returning the key', () => {
    const accessKey = 'A'.repeat(43)
    const failures = artifactBoundaryFailures(
      [Buffer.from(`https://doge.h1ka.ru ${accessKey}`)],
      accessKey,
    )

    expect(failures).toEqual([
      'A fixed Gateway origin was embedded in the G2 artifact: https://doge.h1ka.ru',
      'A local access key was embedded in the G2 artifact',
    ])
    expect(failures.join('\n')).not.toContain(accessKey)
  })
})

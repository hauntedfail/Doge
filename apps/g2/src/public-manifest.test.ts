import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

describe('public Even Hub manifest', () => {
  it('allows user-selected HTTPS services without embedding an owner gateway', async () => {
    const manifest = JSON.parse(
      await readFile(new URL('../app.production.json', import.meta.url), 'utf8'),
    ) as {
      permissions?: Array<{ name?: string; desc?: string; whitelist?: string[] }>
    }
    const network = manifest.permissions?.find((permission) => permission.name === 'network')

    expect(network?.whitelist).toEqual(['https://'])
    expect(network?.desc?.toLowerCase()).not.toContain('gateway')
    expect(JSON.stringify(manifest)).not.toContain('doge.h1ka.ru')
  })
})

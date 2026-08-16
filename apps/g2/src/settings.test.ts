import { describe, expect, it, vi } from 'vitest'
import {
  loadGatewaySettings,
  normaliseGatewayUrl,
  saveGatewaySettings,
  type GatewaySettings,
  type SettingsStore,
} from './settings.js'

const token = 'A'.repeat(43)

function memoryStore(initial = ''): SettingsStore & { value: () => string } {
  let value = initial
  return {
    get: vi.fn(async () => value),
    set: vi.fn(async (_key, next) => {
      value = next
      return true
    }),
    value: () => value,
  }
}

describe('gateway settings', () => {
  it('loads a previously verified native gateway and access token', async () => {
    const stored: GatewaySettings = {
      gatewayUrl: 'https://doge.example',
      accessToken: token,
    }
    const primary = memoryStore(JSON.stringify(stored))

    await expect(loadGatewaySettings(primary, undefined)).resolves.toEqual(stored)
  })

  it('starts unconfigured instead of injecting a build-time gateway', async () => {
    const primary = memoryStore()

    await expect(loadGatewaySettings(primary, undefined)).resolves.toEqual({
      gatewayUrl: null,
      accessToken: null,
    })
    expect(primary.value()).toBe('')
  })

  it('migrates a valid WebView fallback into native storage', async () => {
    const primary = memoryStore()
    const fallback = memoryStore(
      JSON.stringify({ gatewayUrl: 'https://relay.example/', accessToken: token }),
    )

    const loaded = await loadGatewaySettings(primary, fallback)

    expect(loaded).toEqual({ gatewayUrl: 'https://relay.example', accessToken: token })
    expect(JSON.parse(primary.value())).toEqual(loaded)
  })

  it('still restores the fallback when native storage is temporarily unavailable', async () => {
    const primary: SettingsStore = {
      get: vi.fn(async () => ''),
      set: vi.fn(async () => false),
    }
    const fallback = memoryStore(
      JSON.stringify({ gatewayUrl: 'https://relay.example', accessToken: token }),
    )

    await expect(loadGatewaySettings(primary, fallback)).resolves.toEqual({
      gatewayUrl: 'https://relay.example',
      accessToken: token,
    })
  })

  it('accepts HTTPS origins and local HTTP development origins only', () => {
    expect(normaliseGatewayUrl(' https://gateway.example/ ')).toBe('https://gateway.example')
    expect(normaliseGatewayUrl('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787')
    expect(() => normaliseGatewayUrl('http://doge.example')).toThrow('HTTPS')
    expect(() => normaliseGatewayUrl('https://user:pass@doge.example')).toThrow('origin')
    expect(() => normaliseGatewayUrl('https://doge.example/path')).toThrow('origin')
  })

  it('does not persist candidate settings unless connection validation succeeds', async () => {
    const store = memoryStore()
    const candidate = { gatewayUrl: 'https://doge.example', accessToken: token }
    const reject = vi.fn(async () => false)

    await expect(saveGatewaySettings(store, candidate, reject)).rejects.toThrow(
      'Gateway authentication failed',
    )
    expect(store.value()).toBe('')

    const accept = vi.fn(async () => true)
    await expect(saveGatewaySettings(store, candidate, accept)).resolves.toEqual(candidate)
    expect(JSON.parse(store.value())).toEqual(candidate)
  })

  it('rejects an access key without a gateway URL', async () => {
    const store = memoryStore()

    await expect(
      saveGatewaySettings(store, { gatewayUrl: null, accessToken: token }, vi.fn()),
    ).rejects.toThrow('Gateway URL')
    expect(store.value()).toBe('')
  })
})

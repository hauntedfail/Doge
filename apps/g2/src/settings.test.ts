import { describe, expect, it, vi } from 'vitest'
import {
  GATEWAY_ACCESS_KEY_KEY,
  GATEWAY_SETTINGS_KEY,
  GATEWAY_URL_DRAFT_KEY,
  loadGatewayAccessKey,
  loadGatewayUrlDraft,
  loadGatewaySettings,
  nativeSettingsStore,
  normaliseGatewayUrl,
  restoreGatewaySettings,
  saveGatewaySettings,
  writeGatewayUrlDraft,
  type GatewaySettings,
  type SettingsStore,
} from './settings.js'

const token = 'A'.repeat(43)

function memoryStore(initial = ''): SettingsStore & { value: () => string } {
  const values = new Map<string, string>()
  if (initial) values.set(GATEWAY_SETTINGS_KEY, initial)
  return {
    get: vi.fn(async (key) => values.get(key) ?? ''),
    set: vi.fn(async (key, next) => {
      values.set(key, next)
      return true
    }),
    value: () => values.get(GATEWAY_SETTINGS_KEY) ?? '',
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
    await expect(store.get(GATEWAY_ACCESS_KEY_KEY)).resolves.toBe(token)
  })

  it('retains previously saved settings when validation of an edit fails', async () => {
    const previous = { gatewayUrl: 'https://saved.example', accessToken: token }
    const store = memoryStore(JSON.stringify(previous))
    const candidate = { gatewayUrl: 'https://offline.example', accessToken: token }

    await expect(saveGatewaySettings(store, candidate, async () => false)).rejects.toThrow(
      'Gateway authentication failed',
    )
    expect(JSON.parse(store.value())).toEqual(previous)
  })

  it('rejects an access key without a gateway URL', async () => {
    const store = memoryStore()

    await expect(
      saveGatewaySettings(store, { gatewayUrl: null, accessToken: token }, vi.fn()),
    ).rejects.toThrow('Gateway URL')
    expect(store.value()).toBe('')
  })

  it('persists a normalised URL draft independently of authenticated settings', async () => {
    const values = new Map<string, string>()
    const store: SettingsStore = {
      get: vi.fn(async (key) => values.get(key) ?? ''),
      set: vi.fn(async (key, value) => {
        values.set(key, value)
        return true
      }),
    }

    await expect(writeGatewayUrlDraft(store, 'https://draft.example/')).resolves.toBe(
      'https://draft.example',
    )
    expect(values.get(GATEWAY_URL_DRAFT_KEY)).toBe('https://draft.example')
    expect(values.has(GATEWAY_SETTINGS_KEY)).toBe(false)
  })

  it('restores a URL draft from native storage and migrates a WebView fallback', async () => {
    const primary = {
      get: vi.fn(async () => ''),
      set: vi.fn(async () => true),
    }
    const fallback = {
      get: vi.fn(async (key: string) =>
        key === GATEWAY_URL_DRAFT_KEY ? 'https://draft.example/' : '',
      ),
      set: vi.fn(async () => true),
    }

    await expect(loadGatewayUrlDraft(primary, fallback)).resolves.toBe('https://draft.example')
    expect(primary.set).toHaveBeenCalledWith(GATEWAY_URL_DRAFT_KEY, 'https://draft.example')
  })

  it('uses the Even SDK local-storage methods for persistent settings', async () => {
    const storage = {
      getLocalStorage: vi.fn(async () => 'stored'),
      setLocalStorage: vi.fn(async () => true),
    }
    const store = nativeSettingsStore(storage)

    await expect(store.get(GATEWAY_SETTINGS_KEY)).resolves.toBe('stored')
    await expect(store.set(GATEWAY_SETTINGS_KEY, 'next')).resolves.toBe(true)
    expect(storage.getLocalStorage).toHaveBeenCalledWith(GATEWAY_SETTINGS_KEY)
    expect(storage.setLocalStorage).toHaveBeenCalledWith(GATEWAY_SETTINGS_KEY, 'next')
  })

  it('restores the access key from its dedicated Even SDK storage key', async () => {
    const primary = {
      get: vi.fn(async (key: string) => (key === GATEWAY_ACCESS_KEY_KEY ? token : '')),
      set: vi.fn(async () => true),
    }

    await expect(loadGatewayAccessKey(primary, undefined)).resolves.toBe(token)
    expect(primary.get).toHaveBeenCalledWith(GATEWAY_ACCESS_KEY_KEY)
  })

  it('migrates a dedicated WebView access-key fallback into Even SDK storage', async () => {
    const primary = {
      get: vi.fn(async () => ''),
      set: vi.fn(async () => true),
    }
    const fallback = {
      get: vi.fn(async (key: string) => (key === GATEWAY_ACCESS_KEY_KEY ? token : '')),
      set: vi.fn(async () => true),
    }

    await expect(loadGatewayAccessKey(primary, fallback)).resolves.toBe(token)
    expect(primary.set).toHaveBeenCalledWith(GATEWAY_ACCESS_KEY_KEY, token)
  })

  it('restores a connection from the URL draft and dedicated access-key storage', () => {
    expect(
      restoreGatewaySettings(
        { gatewayUrl: null, accessToken: null },
        'https://draft.example',
        token,
      ),
    ).toEqual({ gatewayUrl: 'https://draft.example', accessToken: token })
  })

  it('prefers the dedicated access-key storage over a legacy combined value', () => {
    const currentToken = 'B'.repeat(43)

    expect(
      restoreGatewaySettings(
        { gatewayUrl: 'https://doge.example', accessToken: token },
        null,
        currentToken,
      ),
    ).toEqual({ gatewayUrl: 'https://doge.example', accessToken: currentToken })
  })

  it('restores a verified URL and access key after a simulated app restart', async () => {
    const deviceStorage = memoryStore()
    const candidate = { gatewayUrl: 'https://doge.example', accessToken: token }

    await saveGatewaySettings(deviceStorage, candidate, async () => true)

    const restored = restoreGatewaySettings(
      await loadGatewaySettings(deviceStorage, undefined),
      null,
      await loadGatewayAccessKey(deviceStorage, undefined),
    )
    expect(restored).toEqual(candidate)
  })
})

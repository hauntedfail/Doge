export const GATEWAY_SETTINGS_KEY = 'doge-gateway-settings-v1'

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u

export interface GatewaySettings {
  gatewayUrl: string | null
  accessToken: string | null
}

export interface AuthenticatedGatewaySettings extends GatewaySettings {
  gatewayUrl: string
  accessToken: string
}

export const EMPTY_GATEWAY_SETTINGS: GatewaySettings = {
  gatewayUrl: null,
  accessToken: null,
}

export interface SettingsStore {
  get(key: string): Promise<string>
  set(key: string, value: string): Promise<boolean>
}

interface WebStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface NativeStorage {
  getLocalStorage(key: string): Promise<string>
  setLocalStorage(key: string, value: string): Promise<boolean>
}

export function normaliseGatewayUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Enter a valid Gateway URL.')
  }
  const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHost)) {
    throw new Error('Gateway URL must use HTTPS (local development may use HTTP).')
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Gateway URL must be an origin without credentials, path, query, or fragment.')
  }
  return url.origin
}

function normaliseSettings(value: unknown): GatewaySettings | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<GatewaySettings>
  if (
    candidate.accessToken !== null &&
    (typeof candidate.accessToken !== 'string' || !ACCESS_TOKEN_PATTERN.test(candidate.accessToken))
  ) {
    return null
  }
  if (candidate.gatewayUrl === null) {
    return candidate.accessToken == null ? { ...EMPTY_GATEWAY_SETTINGS } : null
  }
  if (typeof candidate.gatewayUrl !== 'string') return null
  try {
    return {
      gatewayUrl: normaliseGatewayUrl(candidate.gatewayUrl),
      accessToken: candidate.accessToken ?? null,
    }
  } catch {
    return null
  }
}

async function readSettings(store: SettingsStore | undefined): Promise<GatewaySettings | null> {
  if (!store) return null
  try {
    const value = await store.get(GATEWAY_SETTINGS_KEY)
    return value ? normaliseSettings(JSON.parse(value) as unknown) : null
  } catch {
    return null
  }
}

export async function writeGatewaySettings(
  store: SettingsStore,
  settings: GatewaySettings,
): Promise<GatewaySettings> {
  const normalised = normaliseSettings(settings)
  if (!normalised) throw new Error('Gateway settings are invalid.')
  if (!(await store.set(GATEWAY_SETTINGS_KEY, JSON.stringify(normalised)))) {
    throw new Error('The Even app could not save Gateway settings.')
  }
  return normalised
}

export async function loadGatewaySettings(
  primary: SettingsStore,
  fallback: SettingsStore | undefined,
): Promise<GatewaySettings> {
  const native = await readSettings(primary)
  if (native) return native

  const migrated = await readSettings(fallback)
  if (!migrated) return { ...EMPTY_GATEWAY_SETTINGS }
  try {
    await writeGatewaySettings(primary, migrated)
  } catch {
    // The current session can continue with the verified WebView fallback. A later launch retries
    // native persistence rather than making a transient host-storage failure block the glasses UI.
  }
  return migrated
}

export async function saveGatewaySettings(
  store: SettingsStore,
  candidate: GatewaySettings,
  validate: (settings: AuthenticatedGatewaySettings) => Promise<boolean>,
): Promise<AuthenticatedGatewaySettings> {
  const normalised = normaliseSettings(candidate)
  if (!normalised?.gatewayUrl) throw new Error('Enter the Gateway URL.')
  if (!normalised?.accessToken) throw new Error('Enter the 43-character Doge access key.')
  if (!(await validate(normalised as AuthenticatedGatewaySettings))) {
    throw new Error('Gateway authentication failed. Existing settings were kept.')
  }
  await writeGatewaySettings(store, normalised)
  return normalised as AuthenticatedGatewaySettings
}

export function browserSettingsStore(storage: WebStorage): SettingsStore {
  return {
    get: async (key) => storage.getItem(key) ?? '',
    set: async (key, value) => {
      try {
        storage.setItem(key, value)
        return true
      } catch {
        return false
      }
    },
  }
}

export function nativeSettingsStore(storage: NativeStorage): SettingsStore {
  return {
    get: async (key) => storage.getLocalStorage(key),
    set: async (key, value) => storage.setLocalStorage(key, value),
  }
}

const ACCESS_TOKEN_KEY = 'doge-access-key'
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u

interface TokenStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem?(key: string): void
}

let runtimeToken: string | null = null

export function tokenFromFragment(fragment: string): string | null {
  const value = fragment.startsWith('#') ? fragment.slice(1) : fragment
  const tokens = new URLSearchParams(value).getAll('access_token')
  if (tokens.length !== 1) return null
  const token = tokens[0]
  return token && ACCESS_TOKEN_PATTERN.test(token) ? token : null
}

export function persistAccessToken(token: string, storage: TokenStorage): boolean {
  if (!ACCESS_TOKEN_PATTERN.test(token)) return false
  storage.setItem(ACCESS_TOKEN_KEY, token)
  return true
}

export function saveBrowserAccessToken(token: string): boolean {
  try {
    if (!persistAccessToken(token.trim(), window.localStorage)) return false
    runtimeToken = token.trim()
    return true
  } catch {
    return false
  }
}

export function clearBrowserAccessToken(): void {
  runtimeToken = null
  try {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY)
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  } catch {
    // The in-memory token is still cleared when WebView storage is unavailable.
  }
}

export function browserAccessToken(): string | null {
  const fragmentToken = tokenFromFragment(window.location.hash)
  if (fragmentToken) {
    runtimeToken = fragmentToken
    try {
      persistAccessToken(fragmentToken, window.localStorage)
    } catch {
      // Some embedded WebViews disable storage; the in-memory copy still works.
    }
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    } catch {
      // Authentication does not depend on hiding the fragment from the address bar.
    }
    return fragmentToken
  }

  if (runtimeToken) return runtimeToken
  try {
    const stored =
      window.localStorage.getItem(ACCESS_TOKEN_KEY) ??
      window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (stored && ACCESS_TOKEN_PATTERN.test(stored)) {
      runtimeToken = stored
      persistAccessToken(stored, window.localStorage)
      return stored
    }
  } catch {
    // Treat unavailable storage as an unauthenticated session.
  }
  return null
}

const ACCESS_TOKEN_KEY = 'g2-x-reader-access-token'
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u

let runtimeToken: string | null = null

export function tokenFromFragment(fragment: string): string | null {
  const value = fragment.startsWith('#') ? fragment.slice(1) : fragment
  const tokens = new URLSearchParams(value).getAll('access_token')
  if (tokens.length !== 1) return null
  const token = tokens[0]
  return token && ACCESS_TOKEN_PATTERN.test(token) ? token : null
}

export function browserAccessToken(): string | null {
  const fragmentToken = tokenFromFragment(window.location.hash)
  if (fragmentToken) {
    runtimeToken = fragmentToken
    try {
      window.sessionStorage.setItem(ACCESS_TOKEN_KEY, fragmentToken)
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
    const stored = window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
    if (stored && ACCESS_TOKEN_PATTERN.test(stored)) {
      runtimeToken = stored
      return stored
    }
  } catch {
    // Treat unavailable storage as an unauthenticated session.
  }
  return null
}

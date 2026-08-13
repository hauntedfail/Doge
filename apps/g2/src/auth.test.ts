import { describe, expect, it, vi } from 'vitest'
import { persistAccessToken, tokenFromFragment } from './auth.js'

const validToken = 'A'.repeat(43)

describe('QR access token', () => {
  it('accepts one 256-bit base64url token from the URL fragment', () => {
    expect(tokenFromFragment(`#access_token=${validToken}`)).toBe(validToken)
    expect(tokenFromFragment(`access_token=${validToken}&preview=live`)).toBe(validToken)
  })

  it('rejects malformed or ambiguous token fragments', () => {
    expect(tokenFromFragment('#access_token=short')).toBeNull()
    expect(tokenFromFragment(`#access_token=${'A'.repeat(42)}!`)).toBeNull()
    expect(
      tokenFromFragment(`#access_token=${validToken}&access_token=${'B'.repeat(43)}`),
    ).toBeNull()
    expect(tokenFromFragment('#preview=live')).toBeNull()
  })
})

describe('installed Doge access token', () => {
  it('persists a valid token for future app launches', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    }

    expect(persistAccessToken(validToken, storage)).toBe(true)
    expect([...values.values()]).toEqual([validToken])
  })

  it('rejects malformed tokens without changing storage', () => {
    const setItem = vi.fn()
    expect(persistAccessToken('short', { getItem: () => null, setItem })).toBe(false)
    expect(setItem).not.toHaveBeenCalled()
  })
})

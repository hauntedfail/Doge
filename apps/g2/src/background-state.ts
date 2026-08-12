type JsonRecord = Record<string, unknown>

declare global {
  interface Window {
    __getStateSnapshot?: () => string
    __restoreState?: (snapshot: string | JsonRecord) => void
  }
}

export function registerBackgroundState(
  key: string,
  snapshot: () => object,
  restore: (saved: unknown) => void,
): void {
  window.__getStateSnapshot = () => JSON.stringify({ [key]: { ...snapshot() } })
  window.__restoreState = (raw) => {
    try {
      const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
      if (typeof parsed === 'object' && parsed !== null && key in parsed) {
        restore((parsed as JsonRecord)[key])
      }
    } catch (error) {
      console.warn('Ignored invalid Even Hub background snapshot', error)
    }
  }
}

const VIEW_HISTORY_KEY = 'doge.viewed-post-ids.v1'
const MAX_VIEW_HISTORY = 200
const postIdPattern = /^\d{1,24}$/u

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function loadViewHistory(storage: StorageLike): string[] {
  try {
    const raw = storage.getItem(VIEW_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (
      !Array.isArray(parsed) ||
      !parsed.every((id) => typeof id === 'string' && postIdPattern.test(id))
    ) {
      return []
    }
    return [...new Set(parsed)].slice(-MAX_VIEW_HISTORY)
  } catch {
    return []
  }
}

export function saveViewHistory(storage: StorageLike, postIds: readonly string[]): void {
  try {
    const safeIds = [...new Set(postIds.filter((id) => postIdPattern.test(id)))].slice(
      -MAX_VIEW_HISTORY,
    )
    storage.setItem(VIEW_HISTORY_KEY, JSON.stringify(safeIds))
  } catch {
    // Browsing still works if the host WebView denies persistent storage.
  }
}

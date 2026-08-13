export type InputAction =
  'next' | 'previous' | 'toggle-detail' | 'open-menu' | 'double-tap' | 'cleanup' | null

interface EventPart {
  eventType?: number
  eventSource?: number
}
export interface InputEventLike {
  textEvent?: EventPart
  sysEvent?: EventPart
}

export function classifyInput(event: InputEventLike): InputAction {
  // G2 scrolls in the finger's travel direction rather than moving content
  // as though it were being dragged: slide down to advance, up to go back.
  if (event.textEvent?.eventType === 1) return 'previous'
  if (event.textEvent?.eventType === 2) return 'next'
  const type = event.sysEvent?.eventType
  if (type === 3) return 'double-tap'
  if (type === 6 || type === 7) return 'cleanup'
  if (type === 0 || type === undefined) {
    if (!event.sysEvent) return null
    return 'open-menu'
  }
  return null
}

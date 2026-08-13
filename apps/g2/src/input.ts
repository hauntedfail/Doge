export type InputAction =
  'next' | 'previous' | 'cycle-feed' | 'toggle-detail' | 'open-menu' | 'exit' | 'cleanup' | null

interface EventPart {
  eventType?: number
  eventSource?: number
}
export interface InputEventLike {
  textEvent?: EventPart
  sysEvent?: EventPart
}

export function classifyInput(event: InputEventLike): InputAction {
  if (event.textEvent?.eventType === 1) return 'next'
  if (event.textEvent?.eventType === 2) return 'previous'
  const type = event.sysEvent?.eventType
  if (type === 3) return 'exit'
  if (type === 6 || type === 7) return 'cleanup'
  if (type === 0 || type === undefined) {
    if (!event.sysEvent) return null
    return event.sysEvent.eventSource === 2 ? 'cycle-feed' : 'open-menu'
  }
  return null
}

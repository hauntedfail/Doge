export type SwipeDirection = 'next' | 'previous'
export type InputIntent =
  | { type: 'swipe'; direction: SwipeDirection }
  | { type: 'confirm'; selectionIndex: number | null }
  | { type: 'back' }
  | { type: 'cleanup' }
  | null

interface EventPart {
  eventType?: number
  eventSource?: number
}
interface ListEventPart extends EventPart {
  currentSelectItemIndex?: number
}
export interface InputEventLike {
  textEvent?: EventPart
  sysEvent?: EventPart
  listEvent?: ListEventPart
}

export function classifyInput(event: InputEventLike): InputIntent {
  // G2 scrolls in the finger's travel direction rather than moving content
  // as though it were being dragged: slide down to advance, up to go back.
  if (event.textEvent?.eventType === 1) return { type: 'swipe', direction: 'previous' }
  if (event.textEvent?.eventType === 2) return { type: 'swipe', direction: 'next' }
  if (event.listEvent && (event.listEvent.eventType ?? 0) === 0) {
    return { type: 'confirm', selectionIndex: event.listEvent.currentSelectItemIndex ?? 0 }
  }
  const type = event.sysEvent?.eventType
  if (type === 3) return { type: 'back' }
  if (type === 6 || type === 7) return { type: 'cleanup' }
  if (type === 0 || type === undefined) {
    if (!event.sysEvent) return null
    return { type: 'confirm', selectionIndex: null }
  }
  return null
}

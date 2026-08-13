import type { InputAction } from './input.js'
import type { ReaderState } from './reader-state.js'

type TimelinePosition = Pick<ReaderState, 'mode' | 'status' | 'index'>

export function shouldReloadTimeline(
  action: InputAction,
  state: TimelinePosition,
  bodyPage: number,
): boolean {
  return (
    action === 'previous' &&
    state.mode === 'timeline' &&
    state.status === 'ready' &&
    state.index === 0 &&
    bodyPage === 0
  )
}

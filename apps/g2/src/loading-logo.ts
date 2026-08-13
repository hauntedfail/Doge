import type { LoadingOperation } from './loading-progress.js'

export const G2_CANVAS_WIDTH = 576
export const LOADING_LOGO_SOURCE = '/doge-icon.png'

const LOADING_LOGO_SIZE = 96

export const LOADING_LOGO_LAYOUT = {
  x: Math.floor((G2_CANVAS_WIDTH - LOADING_LOGO_SIZE) / 2),
  y: 14,
  width: LOADING_LOGO_SIZE,
  height: LOADING_LOGO_SIZE,
} as const

export function shouldShowLoadingLogo(operation: LoadingOperation): boolean {
  return operation === 'initial'
}

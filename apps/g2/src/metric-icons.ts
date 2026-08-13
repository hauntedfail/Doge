export const METRIC_ICON_SIZE = 28
export const METRIC_STRIP_WIDTH = 288

export const METRIC_ICON_KINDS = ['reply', 'repost', 'like', 'bookmark'] as const

export type MetricIconKind = (typeof METRIC_ICON_KINDS)[number]

export const METRIC_ICON_PATHS: Readonly<Record<MetricIconKind, string>> = {
  reply:
    'M12 3C7.03 3 3 6.58 3 11C3 13.48 4.28 15.7 6.3 17.17L5 21L9.34 18.82C10.2 18.94 11.09 19 12 19C16.97 19 21 15.42 21 11C21 6.58 16.97 3 12 3Z',
  repost: 'M17 3L21 7L17 11M3 7H21M7 21L3 17L7 13M21 17H3',
  like: 'M20.84 4.61C18.8 2.57 15.5 2.57 13.46 4.61L12 6.07L10.54 4.61C8.5 2.57 5.2 2.57 3.16 4.61C1.12 6.65 1.12 9.95 3.16 11.99L12 20.83L20.84 11.99C22.88 9.95 22.88 6.65 20.84 4.61Z',
  bookmark: 'M5 3H19V21L12 16L5 21Z',
}

export interface MetricViewerState {
  viewerHasLiked: boolean
  viewerHasReposted: boolean
  viewerHasBookmarked: boolean
}

const ICON_X: Readonly<Record<MetricIconKind, number>> = {
  reply: 0,
  repost: 88,
  like: 176,
  bookmark: 260,
}

function isActive(kind: MetricIconKind, state: MetricViewerState): boolean {
  if (kind === 'like') return state.viewerHasLiked
  if (kind === 'repost') return state.viewerHasReposted
  if (kind === 'bookmark') return state.viewerHasBookmarked
  return false
}

function drawIcon(context: CanvasRenderingContext2D, kind: MetricIconKind, active: boolean): void {
  const path = new Path2D(METRIC_ICON_PATHS[kind])
  context.strokeStyle = '#fff'
  context.fillStyle = '#fff'
  context.lineWidth = active && kind === 'repost' ? 3.5 : 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  if (active && (kind === 'like' || kind === 'bookmark')) context.fill(path)
  context.stroke(path)
}

export function renderMetricIcon(kind: MetricIconKind, active = false): string {
  const canvas = document.createElement('canvas')
  canvas.width = METRIC_ICON_SIZE
  canvas.height = METRIC_ICON_SIZE
  const context = canvas.getContext('2d')
  if (!context) return ''

  context.fillStyle = '#000'
  context.fillRect(0, 0, METRIC_ICON_SIZE, METRIC_ICON_SIZE)
  context.save()
  context.translate(2, 2)
  drawIcon(context, kind, active)
  context.restore()
  return canvas.toDataURL('image/png').split(',', 2)[1] ?? ''
}

export function renderMetricIconStrip(
  state: MetricViewerState = {
    viewerHasLiked: false,
    viewerHasReposted: false,
    viewerHasBookmarked: false,
  },
): string {
  const canvas = document.createElement('canvas')
  canvas.width = METRIC_STRIP_WIDTH
  canvas.height = METRIC_ICON_SIZE
  const context = canvas.getContext('2d')
  if (!context) return ''

  context.fillStyle = '#000'
  context.fillRect(0, 0, METRIC_STRIP_WIDTH, METRIC_ICON_SIZE)
  for (const kind of METRIC_ICON_KINDS) {
    context.save()
    context.translate(ICON_X[kind] + 2, 2)
    drawIcon(context, kind, isActive(kind, state))
    context.restore()
  }
  return canvas.toDataURL('image/png').split(',', 2)[1] ?? ''
}

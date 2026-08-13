export const METRIC_ICON_SIZE = 28
export const METRIC_STRIP_WIDTH = 288

export const METRIC_ICON_KINDS = ['reply', 'repost', 'like'] as const

export type MetricIconKind = (typeof METRIC_ICON_KINDS)[number]

export const METRIC_ICON_PATHS: Readonly<Record<MetricIconKind, string>> = {
  reply:
    'M12 3C7.03 3 3 6.58 3 11C3 13.48 4.28 15.7 6.3 17.17L5 21L9.34 18.82C10.2 18.94 11.09 19 12 19C16.97 19 21 15.42 21 11C21 6.58 16.97 3 12 3Z',
  repost: 'M17 3L21 7L17 11M3 7H21M7 21L3 17L7 13M21 17H3',
  like: 'M20.84 4.61C18.8 2.57 15.5 2.57 13.46 4.61L12 6.07L10.54 4.61C8.5 2.57 5.2 2.57 3.16 4.61C1.12 6.65 1.12 9.95 3.16 11.99L12 20.83L20.84 11.99C22.88 9.95 22.88 6.65 20.84 4.61Z',
}

export function renderMetricIcon(kind: MetricIconKind): string {
  const canvas = document.createElement('canvas')
  canvas.width = METRIC_ICON_SIZE
  canvas.height = METRIC_ICON_SIZE
  const context = canvas.getContext('2d')
  if (!context) return ''

  context.fillStyle = '#000'
  context.fillRect(0, 0, METRIC_ICON_SIZE, METRIC_ICON_SIZE)
  context.save()
  context.translate(2, 2)
  context.strokeStyle = '#fff'
  context.lineWidth = 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  context.stroke(new Path2D(METRIC_ICON_PATHS[kind]))
  context.restore()
  return canvas.toDataURL('image/png').split(',', 2)[1] ?? ''
}

export function renderMetricIconStrip(): string {
  const canvas = document.createElement('canvas')
  canvas.width = METRIC_STRIP_WIDTH
  canvas.height = METRIC_ICON_SIZE
  const context = canvas.getContext('2d')
  if (!context) return ''

  context.fillStyle = '#000'
  context.fillRect(0, 0, METRIC_STRIP_WIDTH, METRIC_ICON_SIZE)
  context.strokeStyle = '#fff'
  context.lineWidth = 2
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const [index, kind] of METRIC_ICON_KINDS.entries()) {
    context.save()
    context.translate(index * 96 + 2, 2)
    context.stroke(new Path2D(METRIC_ICON_PATHS[kind]))
    context.restore()
  }
  return canvas.toDataURL('image/png').split(',', 2)[1] ?? ''
}

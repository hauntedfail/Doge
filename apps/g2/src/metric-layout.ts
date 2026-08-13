import { getTextWidth } from '@evenrealities/pretext'
import {
  METRIC_ICON_KINDS,
  METRIC_ICON_SIZE,
  METRIC_ICON_X,
  type MetricIconKind,
} from './metric-icons.js'

export const METRIC_STRIP_X = 72
export const METRIC_STRIP_Y = 262
export const METRIC_COUNT_Y = 258
export const METRIC_COUNT_WIDTH = 45
export const METRIC_COUNT_HEIGHT = 28

export interface MetricFooterItem {
  kind: MetricIconKind
  iconX: number
  iconY: number
  iconSize: number
  countX: number
  countY: number
  countWidth: number
  countHeight: number
}

export const METRIC_FOOTER_LAYOUT: readonly MetricFooterItem[] = METRIC_ICON_KINDS.map((kind) => ({
  kind,
  iconX: METRIC_STRIP_X + METRIC_ICON_X[kind],
  iconY: METRIC_STRIP_Y,
  iconSize: METRIC_ICON_SIZE,
  countX: METRIC_STRIP_X + METRIC_ICON_X[kind] + METRIC_ICON_SIZE + 2,
  countY: METRIC_COUNT_Y,
  countWidth: METRIC_COUNT_WIDTH,
  countHeight: METRIC_COUNT_HEIGHT,
}))

const SPACE_WIDTH = getTextWidth('\u00A0')

export function centreMetricCount(content: string, width = METRIC_COUNT_WIDTH): string {
  const leftPadding = Math.max(0, (width - getTextWidth(content)) / 2)
  return `${'\u00A0'.repeat(Math.round(leftPadding / SPACE_WIDTH))}${content}`
}

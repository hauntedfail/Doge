export type LoadingOperation = 'initial' | 'reload' | 'thread'
export type LoadingStage = 'connecting' | 'downloading' | 'preparing' | 'rendering'

export interface LoadingProgress {
  operation: LoadingOperation
  stage: LoadingStage
  target: string
}

export interface LoadingIndicator {
  title: string
  label: string
  percent: number
  progressLine: string
  text: string
}

const STAGE_DETAILS: Readonly<Record<LoadingStage, { label: string; percent: number }>> = {
  connecting: { label: 'Connecting to gateway', percent: 15 },
  downloading: { label: 'Receiving posts', percent: 45 },
  preparing: { label: 'Preparing content', percent: 75 },
  rendering: { label: 'Rendering on G2', percent: 90 },
}

const BAR_WIDTH = 18

export function loadingIndicator(progress: LoadingProgress): LoadingIndicator {
  const details = STAGE_DETAILS[progress.stage]
  const target = progress.target.trim().toUpperCase()
  const title =
    progress.operation === 'reload'
      ? `RELOADING ${target}`
      : progress.operation === 'thread'
        ? 'LOADING THREAD'
        : `LOADING ${target}`
  const filled = Math.round((details.percent / 100) * BAR_WIDTH)
  const progressLine = `${'━'.repeat(filled)}${'─'.repeat(BAR_WIDTH - filled)}  ${details.percent}%`
  return {
    title,
    label: details.label,
    percent: details.percent,
    progressLine,
    text: `${title}\n\n${progressLine}\n${details.label}`,
  }
}

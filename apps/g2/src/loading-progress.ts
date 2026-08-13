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

export type ImageLoadingProgress =
  | { stage: 'requesting' | 'downloading' | 'processing'; target: string }
  | {
      stage: 'transferring'
      completedTiles: 0 | 1 | 2 | 3 | 4
      target: string
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

export function imageLoadingIndicator(progress: ImageLoadingProgress): LoadingIndicator {
  const title = `LOADING ${progress.target.trim().toUpperCase()}`
  let details: { label: string; percent: number }
  switch (progress.stage) {
    case 'requesting':
      details = { label: 'Requesting image', percent: 10 }
      break
    case 'downloading':
      details = { label: 'Receiving image', percent: 30 }
      break
    case 'processing':
      details = { label: 'Preparing image', percent: 50 }
      break
    case 'transferring':
      details = {
        label: `Sending image to G2 · ${progress.completedTiles}/4`,
        percent: 55 + progress.completedTiles * 10,
      }
      break
  }
  const filled = Math.round((details.percent / 100) * BAR_WIDTH)
  const progressLine = `${'━'.repeat(filled)}${'─'.repeat(BAR_WIDTH - filled)}  ${details.percent}%`
  return {
    title,
    label: details.label,
    percent: details.percent,
    progressLine,
    text: `${title}\n${progressLine}\n${details.label}`,
  }
}

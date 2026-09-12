import type { Theme } from '../../betting/types'

const GREEN_LEVELS = [1.35, 1.7, 2.05, 2.45, 2.9, 3.4, 3.95, 4.55, 5.25]
const RED_LEVELS = [1.25, 1.45, 1.68, 1.94, 2.24, 2.58, 2.96, 3.38, 3.84, 4.34, 4.88, 5.55]

/** Shared pacing for the readable flight -> sharp crash -> result sequence. */
export const CRASH_TIMING = {
  coefficientLinearPerSecond: 0.18,
  coefficientQuadraticPerSecond: 0.007,
  explosionDurationMs: 560,
  resultDelayMs: 620,
  returnDelayMs: 2400,
} as const

export function getCrashLevels(theme: Theme) {
  return theme === 'green' ? GREEN_LEVELS : RED_LEVELS
}

export type CrashRoundMock = {
  boosterLevel: number
  crashAt: number
  pointsPerLine: number
}

/**
 * Produces many short flights and a progressively smaller chance of a long one.
 * The exponential tail is capped so a local demo never runs indefinitely.
 */
export function createCrashRoundMock(): CrashRoundMock {
  const exponentialTail = -Math.log(1 - Math.random()) * 1.28

  return {
    boosterLevel: 4,
    crashAt: Math.min(5.55, 1.2 + exponentialTail),
    pointsPerLine: 10,
  }
}


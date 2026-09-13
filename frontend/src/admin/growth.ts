export const GROWTH_PREVIEW_MULTIPLIERS = [1.2, 1.5, 2, 3, 5, 10, 20, 50, 100] as const

/** Mirrors the server's time-based curve before its scale-4 wire rounding. */
export function exponentialFlightMultiplier(elapsedSeconds: number, growthRate: number) {
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(growthRate) || elapsedSeconds <= 0) return 1
  return Math.exp(growthRate * elapsedSeconds)
}

/** Analytical inverse used by the Admin pacing preview. */
export function secondsToFlightMultiplier(multiplier: number, growthRate: number) {
  if (!Number.isFinite(multiplier) || !Number.isFinite(growthRate) || multiplier <= 1 || growthRate <= 0) return 0
  return Math.log(multiplier) / growthRate
}

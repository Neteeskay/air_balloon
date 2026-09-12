const MIN_FLIGHT_PROGRESS = 0
const MAX_FLIGHT_PROGRESS = 1

export const FLIGHT_START_PERCENT = 14
export const FLIGHT_DISTANCE_PERCENT = 59

export function clampFlightProgress(progress: number) {
  return Math.min(MAX_FLIGHT_PROGRESS, Math.max(MIN_FLIGHT_PROGRESS, progress))
}

export function getFlightBottomPercent(progress: number) {
  return FLIGHT_START_PERCENT + clampFlightProgress(progress) * FLIGHT_DISTANCE_PERCENT
}

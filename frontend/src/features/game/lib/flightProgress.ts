const MIN_FLIGHT_PROGRESS = 0
const MAX_FLIGHT_PROGRESS = 1

export function clampFlightProgress(progress: number) {
  return Math.min(MAX_FLIGHT_PROGRESS, Math.max(MIN_FLIGHT_PROGRESS, progress))
}

/**
 * Maps the authoritative multiplier to the visual route made up by the
 * authoritative level thresholds. Every threshold owns an equal part of the
 * route; interpolation only happens inside the current threshold segment.
 */
export function getLevelFlightProgress(multiplier: number, levels: number[]) {
  if (!levels.length || !Number.isFinite(multiplier)) return MIN_FLIGHT_PROGRESS

  const firstThreshold = levels[0]
  if (!Number.isFinite(firstThreshold) || firstThreshold <= 1) return MIN_FLIGHT_PROGRESS

  if (multiplier <= 1) return MIN_FLIGHT_PROGRESS
  if (multiplier < firstThreshold) {
    return clampFlightProgress(
      ((multiplier - 1) / (firstThreshold - 1)) / levels.length,
    )
  }

  for (let index = 0; index < levels.length - 1; index += 1) {
    const current = levels[index]
    const next = levels[index + 1]
    if (multiplier < next) {
      const segmentProgress = (multiplier - current) / Math.max(0.0001, next - current)
      return clampFlightProgress((index + 1 + segmentProgress) / levels.length)
    }
  }

  return MAX_FLIGHT_PROGRESS
}

export function getLevelMarkerProgress(levelIndex: number, levelCount: number) {
  if (levelCount <= 0) return MIN_FLIGHT_PROGRESS
  return clampFlightProgress((levelIndex + 1) / levelCount)
}

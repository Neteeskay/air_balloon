const MIN_FLIGHT_PROGRESS = 0
const MAX_FLIGHT_PROGRESS = 1

export function clampFlightProgress(progress: number) {
  return Math.min(MAX_FLIGHT_PROGRESS, Math.max(MIN_FLIGHT_PROGRESS, progress))
}

export const FLIGHT_START_PERCENT = 8
export const FLIGHT_DISTANCE_PERCENT = 84

export function getFlightBottomPercent(progress: number) {
  return FLIGHT_START_PERCENT + clampFlightProgress(progress) * FLIGHT_DISTANCE_PERCENT
}

/** Legacy fallback for snapshots that predate the additive flightMultiplier field. */
export function getVisualFlightCoefficient(
  multiplier: number,
  boosterActivated: boolean,
  boosterMultiplier: number,
) {
  if (!Number.isFinite(multiplier)) return 1
  return boosterActivated && boosterMultiplier > 1
    ? multiplier / boosterMultiplier
    : multiplier
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

/**
 * Maps the coefficient to the visual route without a progressively slower
 * last half of the flight.
 *
 * `getLevelFlightProgress` is intentionally level-oriented: it gives every
 * level the same amount of screen space. That coordinate is kept for level
 * track compatibility, but it makes the balloon slow down whenever the
 * server's coefficient gaps get wider (for example 8 -> 10 -> 12). The
 * flight itself must follow the authoritative coefficient. A coefficient
 * based speed floor therefore wins over the level coordinate once threshold
 * gaps become wide, while the level coordinate still keeps early markers
 * aligned with the existing track.
 */
export function getContinuousFlightProgress(multiplier: number, levels: number[]) {
  if (!levels.length || !Number.isFinite(multiplier)) return MIN_FLIGHT_PROGRESS

  const lastThreshold = levels[levels.length - 1]
  if (typeof lastThreshold !== 'number' || !Number.isFinite(lastThreshold) || lastThreshold <= 1) return MIN_FLIGHT_PROGRESS
  if (multiplier <= 1) return MIN_FLIGHT_PROGRESS

  const levelProgress = getLevelFlightProgress(multiplier, levels)
  const speedFloorThreshold = levels.find(value => value >= 6) ?? lastThreshold
  const speedFloor = ((multiplier - 1) / Math.max(1, speedFloorThreshold - 1)) * 1.2
  if (speedFloor <= 1) return Math.max(levelProgress, clampFlightProgress(speedFloor))

  // There are no level art frames beyond the last threshold, but a long
  // round must still have a changing visual signal. Keep the route itself at
  // the top while exposing a small bounded tail to the background layer.
  return 1 + Math.min(0.6, speedFloor - 1)
}

export function getLevelMarkerProgress(levelIndex: number, levelCount: number) {
  if (levelCount <= 0) return MIN_FLIGHT_PROGRESS
  return clampFlightProgress((levelIndex + 1) / levelCount)
}

/**
 * Converts flight progress into the natural, evenly-spaced level coordinate.
 * The short lead-in keeps level 1 ahead of the balloon at take-off, matching
 * the original scrolling track without coupling the animation to mock timing.
 */
export function getTrackLevelPosition(progress: number, levelCount: number) {
  if (levelCount <= 0) return -0.6

  const scaledProgress = clampFlightProgress(progress) * levelCount
  if (scaledProgress <= 1) return -0.6 + scaledProgress * 0.6

  return Math.min(levelCount - 1, scaledProgress - 1)
}

/** Keeps level lighting attached to the interpolated marker instead of a future server frame. */
export function getVisualReachedLevels(progress: number, levelCount: number) {
  if (levelCount <= 0) return 0
  return Math.min(levelCount, Math.floor(clampFlightProgress(progress) * levelCount + 0.000001))
}

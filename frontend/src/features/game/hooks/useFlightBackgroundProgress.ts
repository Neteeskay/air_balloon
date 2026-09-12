import { useMemo } from 'react'

export const FLIGHT_BACKGROUND_COUNT = 7

export type FlightBackgroundProgress = {
  blend: number
  fromIndex: number
  progress: number
  toIndex: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

// Smoothstep keeps the crossfade gentle at each keyframe and avoids visible snaps.
const smoothstep = (value: number) => value * value * (3 - 2 * value)

export function getFlightBackgroundProgress(progress: number): FlightBackgroundProgress {
  const normalized = clamp(progress)
  const position = normalized * (FLIGHT_BACKGROUND_COUNT - 1)
  const fromIndex = Math.min(FLIGHT_BACKGROUND_COUNT - 1, Math.floor(position))
  const toIndex = Math.min(FLIGHT_BACKGROUND_COUNT - 1, fromIndex + 1)

  return {
    blend: toIndex === fromIndex ? 0 : smoothstep(position - fromIndex),
    fromIndex,
    progress: normalized,
    toIndex,
  }
}

export function useFlightBackgroundProgress(progress: number) {
  return useMemo(() => getFlightBackgroundProgress(progress), [progress])
}

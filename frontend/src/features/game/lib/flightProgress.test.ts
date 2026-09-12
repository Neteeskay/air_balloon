import { describe, expect, it } from 'vitest'
import {
  FLIGHT_DISTANCE_PERCENT,
  FLIGHT_START_PERCENT,
  clampFlightProgress,
  getFlightBottomPercent,
} from './flightProgress'

describe('flight progress coordinates', () => {
  it('maps the normalized round progress to the shared vertical flight position', () => {
    expect(getFlightBottomPercent(0)).toBe(FLIGHT_START_PERCENT)
    expect(getFlightBottomPercent(0.5)).toBe(FLIGHT_START_PERCENT + FLIGHT_DISTANCE_PERCENT / 2)
    expect(getFlightBottomPercent(1)).toBe(FLIGHT_START_PERCENT + FLIGHT_DISTANCE_PERCENT)
  })

  it('clamps delayed or over-complete animation frames', () => {
    expect(clampFlightProgress(-0.2)).toBe(0)
    expect(clampFlightProgress(1.2)).toBe(1)
    expect(getFlightBottomPercent(-0.2)).toBe(FLIGHT_START_PERCENT)
    expect(getFlightBottomPercent(1.2)).toBe(FLIGHT_START_PERCENT + FLIGHT_DISTANCE_PERCENT)
  })
})

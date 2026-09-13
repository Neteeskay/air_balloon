import { describe, expect, it } from 'vitest'
import { exponentialFlightMultiplier, secondsToFlightMultiplier } from './growth'

describe('exponential flight growth preview', () => {
  it('matches the server formula and its analytical inverse', () => {
    expect(exponentialFlightMultiplier(0, 0.2)).toBe(1)
    expect(exponentialFlightMultiplier(5, 0.2)).toBeCloseTo(Math.E, 12)
    expect(secondsToFlightMultiplier(2, 0.2)).toBeCloseTo(3.4657359, 7)
    expect(exponentialFlightMultiplier(secondsToFlightMultiplier(50, 0.2), 0.2)).toBeCloseTo(50, 10)
  })
})

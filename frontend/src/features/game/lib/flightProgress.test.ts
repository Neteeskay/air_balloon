import { describe, expect, it } from 'vitest'
import {
  clampFlightProgress,
  getLevelFlightProgress,
  getLevelMarkerProgress,
} from './flightProgress'

describe('flight progress coordinates', () => {
  const greenLevels = [1.2, 1.5, 2, 3, 4, 6, 8, 10, 12]

  it('maps authoritative thresholds to equal visual route segments', () => {
    expect(getLevelFlightProgress(1, greenLevels)).toBe(0)
    expect(getLevelFlightProgress(1.2, greenLevels)).toBeCloseTo(1 / 9)
    expect(getLevelFlightProgress(2, greenLevels)).toBeCloseTo(3 / 9)
    expect(getLevelFlightProgress(5, greenLevels)).toBeCloseTo(5.5 / 9)
    expect(getLevelFlightProgress(7, greenLevels)).toBeCloseTo(6.5 / 9)
    expect(getLevelFlightProgress(12, greenLevels)).toBe(1)
  })

  it('keeps multiplier progress monotonic and bounded', () => {
    const samples = [1, 1.15, 1.2, 2, 3, 5, 7, 12, 20]
      .map(multiplier => getLevelFlightProgress(multiplier, greenLevels))
    expect(samples).toEqual([...samples].sort((a, b) => a - b))
    expect(samples[0]).toBe(0)
    expect(samples.at(-1)).toBe(1)
    expect(clampFlightProgress(-0.2)).toBe(0)
    expect(clampFlightProgress(1.2)).toBe(1)
  })

  it('uses the same normalized positions for level markers', () => {
    expect(getLevelMarkerProgress(0, 9)).toBeCloseTo(1 / 9)
    expect(getLevelMarkerProgress(4, 9)).toBeCloseTo(5 / 9)
    expect(getLevelMarkerProgress(8, 9)).toBe(1)
  })
})

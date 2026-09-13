import { describe, expect, it } from 'vitest'
import {
  clampFlightProgress,
  getContinuousFlightProgress,
  getFlightBottomPercent,
  getLevelFlightProgress,
  getLevelMarkerProgress,
  getTrackLevelPosition,
  getVisualFlightCoefficient,
  getVisualReachedLevels,
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

  it('keeps the visual flight speed tied to coefficient time, not threshold gaps', () => {
    const beforeFloor = getContinuousFlightProgress(2, greenLevels)
    const afterFloor = getContinuousFlightProgress(4, greenLevels)

    expect(afterFloor).toBeGreaterThan(beforeFloor)
    expect(getContinuousFlightProgress(3.16, greenLevels)).toBeGreaterThan(0.5)
    expect(getContinuousFlightProgress(6, greenLevels)).toBeGreaterThan(1)
    expect(getContinuousFlightProgress(12, greenLevels)).toBeGreaterThan(1)
    expect(getContinuousFlightProgress(12.1, greenLevels)).toBeGreaterThan(1)
    expect(getContinuousFlightProgress(200, greenLevels)).toBeLessThanOrEqual(1.6)
  })

  it('uses the same normalized positions for level markers', () => {
    expect(getLevelMarkerProgress(0, 9)).toBeCloseTo(1 / 9)
    expect(getLevelMarkerProgress(4, 9)).toBeCloseTo(5 / 9)
    expect(getLevelMarkerProgress(8, 9)).toBe(1)
  })

  it('keeps the booster jump out of visual flight progress', () => {
    expect(getVisualFlightCoefficient(2, false, 3)).toBe(2)
    expect(getVisualFlightCoefficient(6, true, 3)).toBe(2)
  })

  it('keeps the balloon route inside the safe flight area', () => {
    expect(getFlightBottomPercent(0)).toBe(8)
    expect(getFlightBottomPercent(1)).toBe(92)
  })

  it('aligns the scrolling world with every level marker', () => {
    expect(getTrackLevelPosition(0, 12)).toBeCloseTo(-0.6)
    expect(getTrackLevelPosition(getLevelMarkerProgress(0, 12), 12)).toBeCloseTo(0)
    expect(getTrackLevelPosition(getLevelMarkerProgress(5, 12), 12)).toBeCloseTo(5)
    expect(getTrackLevelPosition(1, 12)).toBeCloseTo(11)
  })

  it('lights a level only when the interpolated marker reaches it', () => {
    expect(getVisualReachedLevels(0.1, 9)).toBe(0)
    expect(getVisualReachedLevels(1 / 9, 9)).toBe(1)
    expect(getVisualReachedLevels(2 / 9 - 0.001, 9)).toBe(1)
    expect(getVisualReachedLevels(1, 9)).toBe(9)
  })
})

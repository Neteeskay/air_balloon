import { describe, expect, it } from 'vitest'
import { crashPoint, empiricalCurve, generateCrashPoints, mulberry32, round4, seedFromString, simulateGames, survival, theoreticalCurve } from './math'

describe('crash math model', () => {
  it('rounds crash points down to four decimals', () => {
    expect(round4(1.00004)).toBe(1)
    expect(round4(2.3456789)).toBeCloseTo(2.3456)
    expect(round4(12.99996)).toBeCloseTo(12.9999)
  })

  it('mirrors the piecewise crash formula', () => {
    const params = { alpha: 0.85, minCrashMultiplier: 1, maxMultiplier: 100 }
    // U < alpha → immediate crash at min
    expect(crashPoint(params, 0.1)).toBe(1)
    // U >= alpha → (1 - alpha) / (1 - U)
    expect(crashPoint(params, 0.85)).toBeCloseTo(1)
    expect(crashPoint(params, 0.94)).toBeCloseTo(2.5)
    // raw result above max is clamped
    expect(crashPoint(params, 0.999999)).toBe(100)
    // fixed range keeps the deterministic demo facility
    const fixed = { alpha: 0.5, minCrashMultiplier: 3, maxMultiplier: 3 }
    expect(crashPoint(fixed, 0.1)).toBe(3)
    expect(crashPoint(fixed, 0.9)).toBe(3)
  })

  it('computes survival probability P(X >= x) = (1 - alpha) / x', () => {
    expect(survival(1, 0.85)).toBeCloseTo(0.15)
    expect(survival(2, 0.85)).toBeCloseTo(0.075)
    expect(survival(5, 0.85)).toBeCloseTo(0.03)
    expect(survival(10, 0.85)).toBeCloseTo(0.015)
  })

  it('builds a decreasing theoretical curve from 1 to maxMultiplier', () => {
    const curve = theoreticalCurve({ alpha: 0.85, minCrashMultiplier: 1, maxMultiplier: 100 })
    expect(curve[0].x).toBe(1)
    expect(curve[0].y).toBeCloseTo(0.15)
    expect(curve[curve.length - 1].x).toBe(100)
    expect(curve[curve.length - 1].y).toBeCloseTo(0.0015)
    for (let i = 1; i < curve.length; i++) expect(curve[i].y).toBeLessThan(curve[i - 1].y)
  })

  it('computes the empirical survival fraction of the generated points', () => {
    const points = [1, 1, 2, 5, 10]
    const curve = empiricalCurve(points, [1, 2, 5, 10])
    expect(curve).toHaveLength(4)
    expect(curve[0].y).toBeCloseTo(1)
    expect(curve[1].y).toBeCloseTo(0.6)
    expect(curve[2].y).toBeCloseTo(0.4)
    expect(curve[3].y).toBeCloseTo(0.2)
  })
})

describe('deterministic simulation', () => {
  it('produces reproducible results for the same seed', () => {
    const request = { alpha: 0.85, minCrashMultiplier: 1, maxMultiplier: 100, games: 5000, bet: 10, cashoutTarget: 2, seed: 42 }
    const first = simulateGames(request)
    const second = simulateGames(request)
    expect(first.totalStakes).toBe(50_000)
    expect(first.netResult).toBe(second.netResult)
    expect(first.empirical).toEqual(second.empirical)
    expect(first.games).toBe(5000)
    expect(first.winCount + first.lossCount).toBe(5000)
  })

  it('generates exactly N crash points within the configured bounds', () => {
    const params = { alpha: 0.85, minCrashMultiplier: 1, maxMultiplier: 100 }
    const random = mulberry32(7)
    const points = generateCrashPoints(params, 1000, random)
    expect(points).toHaveLength(1000)
    for (const p of points) {
      expect(p).toBeGreaterThanOrEqual(1)
      expect(p).toBeLessThanOrEqual(100)
    }
  })

  it('long-run average follows the theoretical expectation -alpha * bet', () => {
    // P(X >= 2) = (1 - 0.5) / 2 = 0.25, so expected net per game = 0.25*10 - 0.75*10 = -5
    const result = simulateGames({ alpha: 0.5, minCrashMultiplier: 1, maxMultiplier: 100, games: 200_000, bet: 10, cashoutTarget: 2, seed: 123 })
    expect(result.verdict).toBe('minus')
    expect(result.averageNet).toBeLessThan(-4)
    expect(result.averageNet).toBeGreaterThan(-6)
    expect(result.totalStakes).toBe(result.games * 10)
  })

  it('declares the win/loss threshold by the cashout target', () => {
    const result = simulateGames({ alpha: 0.85, minCrashMultiplier: 1, maxMultiplier: 100, games: 1000, bet: 5, cashoutTarget: 2, seed: 1 })
    expect(result.totalPayouts).toBe(result.winCount * 5 * 2)
    expect(result.netResult).toBeCloseTo(Math.round((result.totalPayouts - result.totalStakes) * 100) / 100, 2)
  })

  it('converts arbitrary seed strings into a stable numeric seed', () => {
    expect(seedFromString('demo-1')).toBe(seedFromString('demo-1'))
    expect(seedFromString('42')).toBe(42)
    expect(seedFromString('')).toBe(0)
  })
})
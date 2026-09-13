import { describe, expect, it } from 'vitest'
import { buildHistogram, crashPoint, empiricalCurve, generateCrashPoints, mulberry32, round4, seedFromString, simulateGames, survival, theoreticalCurve } from './math'

describe('crash math model', () => {
  it('rounds crash points down to four decimals', () => {
    expect(round4(1.00004)).toBe(1)
    expect(round4(2.3456789)).toBeCloseTo(2.3456)
    expect(round4(12.99996)).toBeCloseTo(12.9999)
  })

  it('mirrors the continuous truncated-pareto crash formula', () => {
    const params = { alpha: 0.5, minCrashMultiplier: 1, maxMultiplier: 100 }
    expect(crashPoint(params, 0)).toBe(1)
    expect(crashPoint(params, 0.5)).toBeCloseTo(1.4141)
    expect(crashPoint(params, 0.85)).toBeCloseTo(2.5812)
    expect(crashPoint(params, 0.99)).toBeCloseTo(9.9508)
    // The top floor band [max - 0.0001, max) flips up to the inclusive ceiling ×10
    expect(crashPoint(params, 0.99999999)).toBeCloseTo(100)
    // alpha=0 reduces to the harmonic tail X = 1/(U/max + (1-U)/min)
    expect(crashPoint({ ...params, alpha: 0 }, 0.5)).toBeCloseTo(1.9801)
    // fixed range keeps the deterministic demo facility
    const fixed = { alpha: 0.5, minCrashMultiplier: 3, maxMultiplier: 3 }
    expect(crashPoint(fixed, 0.1)).toBe(3)
    expect(crashPoint(fixed, 0.9)).toBe(3)
  })

  it('computes survival probability P(X >= x) of the truncated Pareto', () => {
    const p = { alpha: 0.85, minCrashMultiplier: 1, maxMultiplier: 100 }
    expect(survival(1, p)).toBe(1)
    expect(survival(2, p)).toBeCloseTo(0.0098)
    expect(survival(100, p)).toBe(0)
    expect(survival(5, p)).toBeGreaterThan(0)
    expect(survival(5, p)).toBeLessThan(0.001)
    expect(survival(10, p)).toBeGreaterThan(0)
    expect(survival(10, p)).toBeLessThan(0.00001)
    const near = { alpha: 0.03, minCrashMultiplier: 1, maxMultiplier: 100 }
    expect(survival(2, near)).toBeCloseTo(0.4849)
  })

  it('builds a decreasing theoretical curve from min to maxMultiplier', () => {
    const curve = theoreticalCurve({ alpha: 0.85, minCrashMultiplier: 1, maxMultiplier: 100 })
    expect(curve[0].x).toBe(1)
    expect(curve[0].y).toBeCloseTo(1)
    expect(curve[curve.length - 1].x).toBe(100)
    expect(curve[curve.length - 1].y).toBe(0)
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

  it('long-run average follows the theoretical expectation', () => {
    // P(X >= 2) of truncated Pareto with alpha=0.5 is ≈ 0.2499,
    // so expected net per game = 0.2499*2*10 - 10 ≈ -5.00.
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

describe('histogram of crash multipliers', () => {
  it('accounts for every game distributed continuously into the bins', () => {
    const params = { alpha: 0.85, minCrashMultiplier: 1, maxMultiplier: 100 }
    const points = generateCrashPoints(params, 20_000, mulberry32(9))
    const hist = buildHistogram(points, params)
    expect(hist.minValue).toBe(1)
    expect(hist.bins).toHaveLength(40)
    const total = hist.bins.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(20_000)
    // no atom: the first bin holds the natural low tail (~54%), far below the
    // old alpha=0.85 instant-crash spike and spread over the neighbouring bins
    const first = hist.bins[0].count / 20_000
    expect(first).toBeGreaterThan(0.4)
    expect(first).toBeLessThan(0.65)
    for (const b of hist.bins) {
      expect(b.lo).toBeLessThan(b.hi)
      expect(b.count).toBeGreaterThanOrEqual(0)
    }
  })

  it('respects a custom bin count and empty bins for a fixed range', () => {
    const hist = buildHistogram([3, 3, 3], { alpha: 0.5, minCrashMultiplier: 3, maxMultiplier: 3 }, 10)
    expect(hist.bins).toHaveLength(0)
  })

  it('exposes the histogram in the simulation result', () => {
    const result = simulateGames({ alpha: 0.85, minCrashMultiplier: 1, maxMultiplier: 100, games: 5000, bet: 10, cashoutTarget: 2, seed: 42 })
    const total = result.histogram.bins.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(5000)
    expect(result.histogram.bins[result.histogram.bins.length - 1].hi).toBe(100)
  })
})
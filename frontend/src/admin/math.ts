/**
 * Client-side crash math mirror of the authoritative backend model
 * (docs/crash-math-model.md) and an N-game simulation used by the admin UI.
 *
 *   U ~ Uniform[0,1)
 *   if U < alpha:           X = minCrashMultiplier
 *   else:                   X = (1 - alpha) / (1 - U)
 *   X_final = round4(min(X, maxMultiplier))
 *
 *   Survival probability for x in [1, maxMultiplier]:
 *   P(X >= x) = (1 - alpha) / x
 */

export interface CrashParams {
  alpha: number
  minCrashMultiplier: number
  maxMultiplier: number
}

export interface SimulationRequest extends CrashParams {
  games: number
  bet: number
  cashoutTarget: number
  seed?: number
}

export interface SimulationResult {
  params: CrashParams
  games: number
  bet: number
  cashoutTarget: number
  totalStakes: number
  totalPayouts: number
  netResult: number
  averageNet: number
  winCount: number
  lossCount: number
  verdict: 'plus' | 'minus' | 'zero'
  theoretical: Point[]
  empirical: Point[]
}

export interface Point { x: number; y: number }

export const RESULT_SCALE = 1e4

/** Round a crash point down to four decimal places (setScale(4, DOWN)). */
export function round4(value: number): number {
  if (!Number.isFinite(value)) return value
  return Math.floor(value * RESULT_SCALE + 1e-9) / RESULT_SCALE
}

/** Deterministic crash point for a uniform sample u in [0, 1). */
export function crashPoint(params: CrashParams, u: number): number {
  const { alpha, minCrashMultiplier, maxMultiplier } = params
  // Fixed range keeps the deterministic demo/test facility: no distribution to sample.
  if (minCrashMultiplier === maxMultiplier) return round4(minCrashMultiplier)
  const raw = u < alpha ? minCrashMultiplier : (1 - alpha) / (1 - u)
  return round4(Math.min(raw, maxMultiplier))
}

/** Survival probability P(X >= x) = (1 - alpha) / x for x >= 1 (brief formula). */
export function survival(x: number, alpha: number): number {
  return (1 - alpha) / x
}

/** Deterministic PRNG (mulberry32) to reproduce a simulation run via seed. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable numeric seed from an arbitrary user-entered string. */
export function seedFromString(value: string): number {
  const trimmed = value.trim()
  if (trimmed === '') return 0
  const numeric = Number(trimmed)
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed)) return numeric >>> 0
  let hash = 2166136261
  for (let i = 0; i < trimmed.length; i++) {
    hash ^= trimmed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Generate N independent crash points using the given uniform source. */
export function generateCrashPoints(params: CrashParams, games: number, random: () => number): number[] {
  const points = new Array<number>(games)
  for (let i = 0; i < games; i++) points[i] = crashPoint(params, random())
  return points
}

/**
 * Log-spaced sample multipliers from 1 to maxMultiplier, capped for readability
 * but always ending exactly on the configured maximum.
 */
export function sampleXs(maxMultiplier: number, count = 60): number[] {
  const max = Math.max(1, maxMultiplier)
  const lo = Math.log10(1)
  const hi = Math.log10(max)
  const xs: number[] = []
  const steps = Math.max(2, Math.min(count, 200))
  for (let i = 0; i < steps; i++) {
    const x = Math.pow(10, lo + (hi - lo) * (i / (steps - 1)))
    xs.push(x)
  }
  xs[0] = 1
  xs[xs.length - 1] = max
  return xs
}

/** Theoretical survival curve P(X >= x) = (1 - alpha) / x. */
export function theoreticalCurve(params: CrashParams, count = 60): Point[] {
  const xs = sampleXs(params.maxMultiplier, count)
  return xs.map(x => ({ x, y: Math.min(1, Math.max(0, survival(x, params.alpha))) }))
}

/**
 * Empirical survival curve from crash points: fraction of games with X >= x.
 * Points are sorted ascending and scanned together with the sample xs.
 */
export function empiricalCurve(points: number[], xs: number[]): Point[] {
  const sorted = (points as number[]).slice().sort((a, b) => a - b)
  const n = sorted.length
  let cursor = 0
  return xs.map(x => {
    while (cursor < n && sorted[cursor] < x) cursor++
    return { x, y: n === 0 ? 0 : (n - cursor) / n }
  })
}

/** Run an N-game simulation and aggregate the financial result. */
export function simulateGames(request: SimulationRequest): SimulationResult {
  const { games, bet, cashoutTarget, seed } = request
  if (!Number.isFinite(games) || games <= 0) throw new Error('Количество игр должно быть больше нуля')
  if (!Number.isFinite(bet) || bet <= 0) throw new Error('Ставка должна быть положительным числом')
  if (!Number.isFinite(cashoutTarget) || cashoutTarget <= 1) throw new Error('Целевой множитель выхода должен быть больше 1')

  const random = seed === undefined ? Math.random : mulberry32(seed)
  const points = generateCrashPoints(request, games, random)

  const totalStakes = bet * games
  let totalPayouts = 0
  let winCount = 0
  for (let i = 0; i < games; i++) {
    if (points[i] >= cashoutTarget) { winCount++; totalPayouts += bet * cashoutTarget }
  }
  totalPayouts = Math.round(totalPayouts * 100) / 100
  const netResult = Math.round((totalPayouts - totalStakes) * 100) / 100
  const xs = sampleXs(request.maxMultiplier)
  return {
    params: request,
    games,
    bet,
    cashoutTarget,
    totalStakes,
    totalPayouts,
    netResult,
    averageNet: Math.round((netResult / games) * 100) / 100,
    winCount,
    lossCount: games - winCount,
    verdict: netResult > 0 ? 'plus' : netResult < 0 ? 'minus' : 'zero',
    theoretical: theoreticalCurve(request),
    empirical: empiricalCurve(points, xs),
  }
}
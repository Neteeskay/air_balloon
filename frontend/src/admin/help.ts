/**
 * Static formula/example help for the crash math model parameters.
 * The generated form already carries purpose (description), allowed range (min/max)
 * and impact (effectOnGame); this map enriches it with formulas and worked
 * examples so the admin understands the math behind the curve.
 */
export interface ParamHelp {
  formula: string
  example: string
}

export const CRASH_PARAM_HELP: Record<string, ParamHelp> = {
  'crash.alpha': {
    formula: 'p = 1 / (1 − α); X = [U·max⁻ᵖ + (1−U)·min⁻ᵖ]^(−1/p); P(X ≥ x) = (x⁻ᵖ − max⁻ᵖ) / (min⁻ᵖ − max⁻ᵖ)',
    example: 'α = 0.85 → кривая сильно смещена к минимуму: P(X ≥ 2) ≈ 1%, P(X ≥ 10) ≈ 0.00002%. α = 0.03 → почти честная игра: P(X ≥ 2) ≈ 48%. Атомов на ×min и ×max у модели нет.',
  },
  'crash.minCrashMultiplier': {
    formula: 'X = minCrashMultiplier при U = 0 — нижняя граница непрерывного распределения',
    example: 'minCrashMultiplier = 1.0 → минимальный крах равен 1.0000, но доля таких исходов непрерывная, а не атомарная.',
  },
  'crash.maxMultiplier': {
    formula: 'X → maxCrashMultiplier при U → 1; верхняя полоса [max − 0.0001, max) округляется вверх до max',
    example: 'maxMultiplier = 100 → исходы из самой верхней полосы дают ровно ×100.0000; вероятность такой полосы пренебрежимо мала (например, при α = 0.03 меньше 0.000001%, ~1 раунд на 100 млн).',
  },
  'crash.multiplierGrowthRate': {
    formula: 'flightX(t) = exp(multiplierGrowthRate × t). После бустера отображаемый и cashout X = flightX × f; физический flightX и момент краша от бустера не меняются.',
    example: 'multiplierGrowthRate = 0.15/с → через 5 с flightX ≈ 2.12, через 10 с flightX ≈ 4.48. X2 достигается примерно за 4.62 с.',
  },
  'crash.fps': {
    formula: 'delta = 1 / fps',
    example: 'fps = 60 → кадр каждые 16.67 мс (delta ≈ 0.0166667).',
  },
  'crash.delta': {
    formula: 'delta = 1 / fps',
    example: 'delta = 0.0166667 ↔ fps = 60.',
  },
}

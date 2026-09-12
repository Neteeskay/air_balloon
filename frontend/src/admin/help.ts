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
    formula: 'if U < α: X = minCrashMultiplier; else X = (1 − α) / (1 − U); P(X ≥ x) = (1 − α) / x',
    example: 'α = 0.85 → в 85% игр шар лопается сразу (X = 1); P(X ≥ 2) = (1 − 0.85) / 2 ≈ 7.5%; P(X ≥ 10) ≈ 1.5%. Для ставки B ожидаемая выплата = B × (1 − α) — это и есть преимущество игры.',
  },
  'crash.minCrashMultiplier': {
    formula: 'X = minCrashMultiplier при событии U < α',
    example: 'minCrashMultiplier = 1.0 → при α = 0.85 в 85% игр шар лопнет сразу на 1.0000.',
  },
  'crash.maxMultiplier': {
    formula: 'X_final = min(raw, maxMultiplier)',
    example: 'сырой результат 500.0 при maxMultiplier = 100 ограничивается до X = 100.0000.',
  },
  'crash.multiplierGrowthRate': {
    formula: 'X(t) = 1 + multiplierGrowthRate × t — линейный рост множителя во времени (до бустера). С бустером ×f: X(t) = (1 + multiplierGrowthRate × t) × f',
    example: 'multiplierGrowthRate = 0.15/с → через 5 с X = 1.75, через 10 с X = 2.50.',
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
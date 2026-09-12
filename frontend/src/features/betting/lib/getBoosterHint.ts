import type { BetOption } from '../types'

const BOOSTER_HINT_BY_MULTIPLIER: Record<Exclude<BetOption['multiplier'], 1>, string> = {
  2: 'Удваивает ваш множитель.',
  3: 'Утраивает ваш множитель.',
  4: 'Увеличивает ваш множитель в четыре раза.',
}

export function getBoosterHint(multiplier: Exclude<BetOption['multiplier'], 1>) {
  return BOOSTER_HINT_BY_MULTIPLIER[multiplier]
}

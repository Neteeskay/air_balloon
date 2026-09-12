import type { BetOption } from '../types'

const BOOSTER_ICON_BY_MULTIPLIER: Record<Exclude<BetOption['multiplier'], 1>, string> = {
  2: '/assets/icons/boosters/booster-x2.png',
  3: '/assets/icons/boosters/booster-x3.png',
  4: '/assets/icons/boosters/booster-x4.png',
}

export function getBoosterIconByMultiplier(
  multiplier: BetOption['multiplier'] | null | undefined,
) {
  if (multiplier === 1) return null

  return BOOSTER_ICON_BY_MULTIPLIER[multiplier ?? 2] ?? BOOSTER_ICON_BY_MULTIPLIER[2]
}

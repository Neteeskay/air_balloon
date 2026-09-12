export type FortunePrizeType = 'rating' | 'coins' | 'puzzle'

export type FortuneWheelPrize = {
  id: string
  type: FortunePrizeType
  amount: number
  title: string
  valueLabel: string
  color: string
}

/** Clockwise order, starting with the sector under the top pointer. */
export const FORTUNE_WHEEL_PRIZES: FortuneWheelPrize[] = [
  { id: 'rating-20', type: 'rating', amount: 20, title: 'очков', valueLabel: '+20', color: '#ffe8b2' },
  { id: 'coins-25', type: 'coins', amount: 25, title: 'монет', valueLabel: '25', color: '#2fa9f5' },
  { id: 'rating-50', type: 'rating', amount: 50, title: 'очков', valueLabel: '+50', color: '#f45e6a' },
  { id: 'coins-50', type: 'coins', amount: 50, title: 'монет', valueLabel: '50', color: '#934cde' },
  { id: 'rating-100', type: 'rating', amount: 100, title: 'очков', valueLabel: '+100', color: '#64c45f' },
  { id: 'coins-100', type: 'coins', amount: 100, title: 'монет', valueLabel: '100', color: '#258ee6' },
  { id: 'rating-30', type: 'rating', amount: 30, title: 'очков', valueLabel: '+30', color: '#ff8747' },
  { id: 'puzzle-1', type: 'puzzle', amount: 1, title: 'пазла', valueLabel: 'Фрагмент', color: '#c56dde' },
]

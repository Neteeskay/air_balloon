import { LockKeyhole } from 'lucide-react'
import { CoinIcon } from './CoinIcon'
import type { BetOption } from '../types'

type PuzzlePieceCardProps = {
  option: BetOption
  puzzleId: number
  balance: number
  activating: boolean
  selected: boolean
  onSelect: () => void
}

export function PuzzlePieceCard({
  option,
  puzzleId,
  balance,
  activating,
  selected,
  onSelect,
}: PuzzlePieceCardProps) {
  const locked = option.cost > balance

  return (
    <button
      aria-disabled={locked}
      aria-label={`Ставка ${option.cost} бонусов, бустер ×${option.multiplier}${locked ? ', недоступно' : ''}`}
      aria-pressed={selected}
      className={`puzzle-card${selected ? ' is-selected' : ''}${locked ? ' is-locked' : ''}${activating ? ' is-activating' : ''}`}
      onClick={onSelect}
      type="button"
    >
      {locked && <LockKeyhole className="lock-icon" size={18} strokeWidth={2.5} />}
      <img alt="" className="puzzle-piece" src={`/assets/puzzle-pieces/pzS_${puzzleId}.svg`} />
      <span className="bet-copy">
        <span className="price">
          <CoinIcon />
          <b>{option.cost}</b>
        </span>
        {option.multiplier === 1 && <span className="boost-label">Без бустера</span>}
        <span className="multiplier">×{option.multiplier}</span>
      </span>
    </button>
  )

}

import { X } from 'lucide-react'
import { getBoosterIconByMultiplier } from '../lib/getBoosterIconByMultiplier'
import { getBoosterHint } from '../lib/getBoosterHint'
import type { BetOption } from '../types'

type PuzzlePieceHintProps = {
  multiplier: Exclude<BetOption['multiplier'], 1>
  onClose?: () => void
}

export function PuzzlePieceHint({ multiplier, onClose }: PuzzlePieceHintProps) {
  const icon = getBoosterIconByMultiplier(multiplier)

  return (
    <span className="puzzle-piece-hint">
      {icon && <img alt="" src={icon} />}
      <span>
        <strong>{getBoosterHint(multiplier)}</strong>
        <span>Выбери пазл и нажми «Начать»</span>
      </span>
      {onClose && (
        <button aria-label="Закрыть подсказку" className="puzzle-hint-close" onClick={onClose} type="button">
          <X size={17} />
        </button>
      )}
    </span>
  )
}

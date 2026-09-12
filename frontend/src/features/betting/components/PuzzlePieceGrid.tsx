import { PuzzlePieceCard } from './PuzzlePieceCard'
import type { BetOption } from '../types'

type PuzzlePieceGridProps = {
  options: BetOption[]
  puzzleIds: number[]
  balance: number
  activatingId: number | null
  selectedId: number | null
  onSelect: (id: number) => void
}

export function PuzzlePieceGrid({
  options,
  puzzleIds,
  balance,
  activatingId,
  selectedId,
  onSelect,
}: PuzzlePieceGridProps) {
  return (
    <div className="puzzle-grid">
      {options.map((option, index) => (
        <PuzzlePieceCard
          activating={activatingId === option.id}
          balance={balance}
          key={option.id}
          onSelect={() => onSelect(option.id)}
          option={option}
          puzzleId={puzzleIds[index]}
          selected={selectedId === option.id}
        />
      ))}
    </div>
  )
}

import { HIGH_FLIGHT_PIECES } from '../../../mocks/puzzleCollection'

type PuzzlePieceGridProps = {
  collectedFragments: number
  compact?: boolean
  locked?: boolean
}

export function PuzzlePieceGrid({ collectedFragments, compact = false, locked = false }: PuzzlePieceGridProps) {
  return (
    <div
      className={`puzzle-piece-grid${compact ? ' is-compact' : ''}${locked ? ' is-locked' : ''}`}
      aria-label={locked ? 'Пазл пока недоступен' : `${collectedFragments} из 12 фрагментов собрано`}
    >
      {HIGH_FLIGHT_PIECES.map((piece, index) => {
        const collected = !locked && index < collectedFragments
        return (
          <span
            className={`puzzle-piece-slot${collected ? ' is-collected' : ''}`}
            data-piece-number={index + 1}
            key={piece.collected}
          >
            <img src={collected ? piece.collected : piece.pending} alt="" />
          </span>
        )
      })}
      {locked && <span className="puzzle-piece-grid__lock" aria-hidden="true">🔒</span>}
    </div>
  )
}

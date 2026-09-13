import { HIGH_FLIGHT_PIECES } from '../../../mocks/puzzleCollection'

type PuzzlePieceGridProps = {
  collectedFragments: number
  totalFragments?: number
  compact?: boolean
  locked?: boolean
}

export function PuzzlePieceGrid({ collectedFragments, totalFragments = 12, compact = false, locked = false }: PuzzlePieceGridProps) {
  const pieces = HIGH_FLIGHT_PIECES.slice(0, Math.max(1, Math.min(HIGH_FLIGHT_PIECES.length, totalFragments)))
  const collected = Math.max(0, Math.min(pieces.length, collectedFragments))
  return (
    <div
      className={`puzzle-piece-grid${compact ? ' is-compact' : ''}${locked ? ' is-locked' : ''}`}
      aria-label={locked ? 'Пазл пока недоступен' : `${collected} из ${pieces.length} фрагментов собрано`}
    >
      {pieces.map((piece, index) => {
        const isCollected = !locked && index < collected
        return (
          <span
            className={`puzzle-piece-slot${isCollected ? ' is-collected' : ' is-pending'}`}
            data-piece-number={index + 1}
            key={piece.collected}
          >
            <img src={isCollected ? piece.collected : piece.pending} alt="" />
          </span>
        )
      })}
      {locked && <span className="puzzle-piece-grid__lock" aria-hidden="true">🔒</span>}
    </div>
  )
}

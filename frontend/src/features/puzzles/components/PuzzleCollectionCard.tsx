import type { MockPuzzle } from '../../../mocks/mockGame'
import { isPuzzleLocked } from '../../../mocks/puzzleCollection'
import { findItem } from '../../avatar/catalog'
import { ItemArt } from '../../avatar/ItemArt'
import { PuzzlePieceGrid } from './PuzzlePieceGrid'

type PuzzleCollectionCardProps = {
  puzzle: MockPuzzle
}

export function PuzzleCollectionCard({ puzzle }: PuzzleCollectionCardProps) {
  const totalFragments = puzzle.totalFragments
  const collected = Math.min(totalFragments, puzzle.collectedFragments)
  const locked = puzzle.locked === true || isPuzzleLocked(puzzle.id)
  const progress = locked ? 0 : Math.round((collected / totalFragments) * 100)
  const completed = !locked && collected === totalFragments
  const rewardItem = findItem(puzzle.rewardClothingId)

  return (
    <article className={`puzzle-collection-card${locked ? ' is-locked' : ''}`}>
      <PuzzlePieceGrid collectedFragments={collected} totalFragments={totalFragments} locked={locked} />
      <div className="puzzle-collection-card__info">
        <h3>{puzzle.name}</h3>
        <strong>{locked ? 'Скоро будет доступен' : `${collected} / ${totalFragments} фрагментов`}</strong>
        <span className="puzzle-collection-card__progress"><i style={{ width: `${progress}%` }} /></span>
        <span className={`puzzle-collection-card__status${completed ? ' is-complete' : ''}${locked ? ' is-upcoming' : ''}`}>
          {locked ? '🔒 Скоро' : completed ? '✓ Собрано' : progress >= 60 ? 'Почти готов' : 'Собирается'}
        </span>
      </div>
      <div className="puzzle-collection-card__reward">
        <small>🎁 Награда за завершение</small>
        <div className="puzzle-collection-card__reward-art">
          {rewardItem ? <ItemArt item={rewardItem} /> : <span aria-hidden="true">🎁</span>}
        </div>
        <strong>{puzzle.rewardName ?? rewardItem?.name ?? puzzle.rewardClothingId}</strong>
        {completed && <span className="puzzle-collection-card__received">✓ Награда получена</span>}
      </div>
    </article>
  )
}

import type { MockPuzzle } from '../../../mocks/mockGame'
import type { PuzzleCollectionMock } from '../../../mocks/puzzleCollection'
import { findItem } from '../../avatar/catalog'
import { ItemArt } from '../../avatar/ItemArt'
import { PuzzlePieceGrid } from './PuzzlePieceGrid'

type PuzzleCollectionCardProps = {
  item: PuzzleCollectionMock
  puzzle?: MockPuzzle
}

export function PuzzleCollectionCard({ item, puzzle }: PuzzleCollectionCardProps) {
  const totalFragments = item.locked ? item.totalFragments : puzzle?.totalFragments ?? item.totalFragments
  const collected = item.locked ? 0 : Math.min(totalFragments, puzzle?.collectedFragments ?? 0)
  const progress = Math.round((collected / totalFragments) * 100)
  const completed = !item.locked && collected === totalFragments
  const rewardItem = item.rewardClothingId ? findItem(item.rewardClothingId) : undefined

  return (
    <article className={`puzzle-collection-card${item.locked ? ' is-locked' : ''}`}>
      <PuzzlePieceGrid collectedFragments={collected} totalFragments={totalFragments} locked={item.locked} />
      <div className="puzzle-collection-card__info">
        <h3>{item.name}</h3>
        <strong>{item.locked ? 'Недоступно' : `${collected} / ${totalFragments} фрагментов`}</strong>
        <span className="puzzle-collection-card__progress"><i style={{ width: `${progress}%` }} /></span>
        <span className={`puzzle-collection-card__status${completed ? ' is-complete' : ''}`}>
          {item.locked ? 'Откроется позже' : completed ? '✓ Собрано' : progress >= 60 ? 'Почти готов' : 'Собирается'}
        </span>
      </div>
      <div className="puzzle-collection-card__reward">
        <small>🎁 Награда за завершение</small>
        <div className="puzzle-collection-card__reward-art">
          {rewardItem ? <ItemArt item={rewardItem} /> : <span aria-hidden="true">🔒</span>}
        </div>
        <strong>{item.rewardName}</strong>
        {completed && <span className="puzzle-collection-card__received">✓ Награда получена</span>}
      </div>
    </article>
  )
}

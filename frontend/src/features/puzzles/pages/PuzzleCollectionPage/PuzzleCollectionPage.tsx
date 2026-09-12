import { useEffect } from 'react'
import type { MockPuzzle } from '../../../../mocks/mockGame'
import { PUZZLE_COLLECTION_MOCKS } from '../../../../mocks/puzzleCollection'
import { PuzzleCollectionCard } from '../../components/PuzzleCollectionCard'
import './PuzzleCollectionPage.css'

type PuzzleCollectionPageProps = {
  onClose: () => void
  puzzle: MockPuzzle
}

export function PuzzleCollectionPage({ onClose, puzzle }: PuzzleCollectionPageProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onClose])

  return (
    <div className="puzzle-collection-shade" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <main
        className="puzzle-collection-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby="puzzle-collection-title"
      >
        <header className="puzzle-collection-page__header">
          <span className="puzzle-collection-page__icon" aria-hidden="true">🧩</span>
          <div>
            <h2 id="puzzle-collection-title">Коллекция пазлов</h2>
            <p>Собирайте фрагменты и получайте награды</p>
          </div>
          <span className="puzzle-collection-page__total">🧩 {puzzle.collectedFragments} / {puzzle.totalFragments} фрагментов</span>
          <button type="button" onClick={onClose} aria-label="Закрыть коллекцию пазлов">×</button>
        </header>

        <section className="puzzle-collection-page__list" aria-label="Список пазлов">
          {PUZZLE_COLLECTION_MOCKS.map((item) => (
            <PuzzleCollectionCard item={item} key={item.id} puzzle={item.locked ? undefined : puzzle} />
          ))}
        </section>
      </main>
    </div>
  )
}

import { useEffect } from 'react'
import type { MockPuzzle } from '../../../../mocks/mockGame'
import { PuzzleCollectionCard } from '../../components/PuzzleCollectionCard'
import './PuzzleCollectionPage.css'

type PuzzleCollectionPageProps = {
  onClose: () => void
  puzzles: MockPuzzle[]
}

export function PuzzleCollectionPage({ onClose, puzzles }: PuzzleCollectionPageProps) {
  const collectedFragments = puzzles.reduce((sum, puzzle) => sum + puzzle.collectedFragments, 0)
  const totalFragments = puzzles.reduce((sum, puzzle) => sum + puzzle.totalFragments, 0)
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
          <span className="puzzle-collection-page__total">🧩 {collectedFragments} / {totalFragments} фрагментов</span>
          <button type="button" onClick={onClose} aria-label="Закрыть коллекцию пазлов">×</button>
        </header>

        <section className="puzzle-collection-page__list" aria-label="Список пазлов">
          {puzzles.map((puzzle) => (
            <PuzzleCollectionCard key={puzzle.id} puzzle={puzzle} />
          ))}
        </section>
      </main>
    </div>
  )
}

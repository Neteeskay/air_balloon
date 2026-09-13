import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PuzzleCollectionPage } from './PuzzleCollectionPage'

describe('PuzzleCollectionPage', () => {
  it('renders all backend puzzle names, thresholds and rewards', () => {
    render(<PuzzleCollectionPage onClose={() => undefined} puzzles={[
      { id: 'puzzle-1', name: 'Вокруг света', totalFragments: 12, collectedFragments: 11, rewardClothingId: 'cloud-scarf', rewardName: 'Облачный шарфик', completed: false },
      { id: 'puzzle-2', name: 'Космическая экспедиция', totalFragments: 8, collectedFragments: 7, rewardClothingId: 'space-hat', rewardName: 'Космическая шапка', completed: false },
      { id: 'puzzle-3', name: 'Небесное путешествие', totalFragments: 6, collectedFragments: 5, rewardClothingId: 'traveler-costume', rewardName: 'Костюм путешественника', completed: false },
    ]} />)

    expect(screen.getByRole('heading', { name: 'Вокруг света' })).toBeInTheDocument()
    expect(screen.getByText('11 / 12 фрагментов')).toBeInTheDocument()
    expect(screen.getByText('Облачный шарфик')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Космическая экспедиция' })).toBeInTheDocument()
    expect(screen.getByText('7 / 8 фрагментов')).toBeInTheDocument()
    expect(screen.getByText('Космическая шапка')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Небесное путешествие' })).toBeInTheDocument()
    expect(screen.getByText('5 / 6 фрагментов')).toBeInTheDocument()
    expect(screen.getByText('Костюм путешественника')).toBeInTheDocument()
    expect(screen.getByText('🧩 23 / 26 фрагментов')).toBeInTheDocument()
  })
})

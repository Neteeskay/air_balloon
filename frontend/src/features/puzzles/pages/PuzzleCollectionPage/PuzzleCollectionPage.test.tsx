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
    expect(screen.getAllByText('Скоро будет доступен')).toHaveLength(2)
    expect(screen.getByText('Космическая шапка')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Небесное путешествие' })).toBeInTheDocument()
    expect(screen.queryByText('5 / 6 фрагментов')).not.toBeInTheDocument()
    expect(screen.getByText('Костюм путешественника')).toBeInTheDocument()
    expect(screen.getByText('🧩 23 / 26 фрагментов')).toBeInTheDocument()
    const cards = screen.getAllByRole('article')
    expect(cards[0]).not.toHaveClass('is-locked')
    expect(cards[1]).toHaveClass('is-locked')
    expect(cards[2]).toHaveClass('is-locked')
    expect(screen.getAllByText('🔒 Скоро')).toHaveLength(2)
    expect(screen.getAllByLabelText('Пазл пока недоступен')).toHaveLength(2)
  })
})

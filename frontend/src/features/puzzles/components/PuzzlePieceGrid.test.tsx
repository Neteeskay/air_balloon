import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PuzzlePieceGrid } from './PuzzlePieceGrid'

describe('PuzzlePieceGrid', () => {
  it('keeps the twelve pieces in reading order and uses pending art after progress', () => {
    const { container } = render(<PuzzlePieceGrid collectedFragments={8} />)
    const slots = [...container.querySelectorAll<HTMLElement>('[data-piece-number]')]

    expect(slots.map((slot) => slot.dataset.pieceNumber)).toEqual(
      Array.from({ length: 12 }, (_, index) => String(index + 1)),
    )
    expect(slots.slice(0, 8).every((slot) => slot.classList.contains('is-collected'))).toBe(true)
    expect(slots.slice(8).every((slot) => !slot.classList.contains('is-collected'))).toBe(true)
    expect(slots[8].querySelector('img')).toHaveAttribute('src', '/assets/puzzle-pieces/npuzzleShina/npzS_9.png')
  })

  it('renders all pieces as pending and marks a locked puzzle', () => {
    const { container } = render(<PuzzlePieceGrid collectedFragments={12} locked />)
    expect(container.querySelectorAll('.puzzle-piece-slot.is-collected')).toHaveLength(0)
    expect(container.querySelector('.puzzle-piece-grid')).toHaveClass('is-locked')
    expect(container.querySelector('.puzzle-piece-grid__lock')).toHaveTextContent('🔒')
  })

  it('supports the server puzzle size without changing the twelve-piece default', () => {
    const { container } = render(<PuzzlePieceGrid collectedFragments={2} totalFragments={6} />)
    expect(container.querySelectorAll('[data-piece-number]')).toHaveLength(6)
    expect(container.querySelector('.puzzle-piece-grid')).toHaveAccessibleName('2 из 6 фрагментов собрано')
  })
})

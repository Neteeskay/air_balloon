import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { mockCatalog } from '../api/mock'
import type { Theme } from '../api/types'
import { Flight, Setup } from './Gameplay'
import { round } from '../test/helpers'

function ThemeHarness() {
  const [theme, setTheme] = useState<Theme>('GREEN')
  return <Setup theme={theme} onTheme={setTheme} catalog={mockCatalog} stake={100} onStake={() => {}} booster={1} onBooster={() => {}} balance={5000} busy={false} onStart={() => {}} onRules={() => {}} onHistory={() => {}} />
}
describe('game components', () => {
  it('renders 9 GREEN levels and 12 RED levels', () => {
    render(<ThemeHarness />)
    expect(screen.getAllByTestId('preview-level')).toHaveLength(9)
    fireEvent.click(screen.getByRole('button', { name: /Red Balloon/i }))
    expect(screen.getAllByTestId('preview-level')).toHaveLength(12)
  })
  it('offers exactly four paired stake and booster choices', () => {
    const stake = vi.fn(); const booster = vi.fn()
    render(<Setup theme="GREEN" onTheme={() => {}} catalog={mockCatalog} stake={100} onStake={stake} booster={1} onBooster={booster} balance={5000} busy={false} onStart={() => {}} onRules={() => {}} onHistory={() => {}} />)
    expect(screen.getAllByTestId('flight-option')).toHaveLength(4)
    fireEvent.click(screen.getByRole('radio', { name: /250.*×2/i }))
    expect(stake).toHaveBeenCalledWith(250); expect(booster).toHaveBeenCalledWith(2)
    expect(screen.queryByLabelText('Точная ставка')).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Бустер' })).not.toBeInTheDocument()
  })
  it('keeps cashout visible but disabled before level one', () => {
    render(<Flight round={round()} connection="connected" busy={false} notice="" onCashout={() => {}} onFairness={() => {}} onReconnect={() => {}} />)
    expect(screen.getByRole('button', { name: /Забрать/i })).toBeDisabled()
  })
  it('enables cashout after level one', () => {
    render(<Flight round={round('GREEN', { currentLevel: 1, currentMultiplier: 1.2, cashoutAvailable: true })} connection="connected" busy={false} notice="" onCashout={vi.fn()} onFairness={() => {}} onReconnect={() => {}} />)
    expect(screen.getByRole('button', { name: /Забрать/i })).toBeEnabled()
  })
  it.each([2, 3, 4])('shows the authoritative ×%i marker from the start', booster => {
    render(<Flight round={round('GREEN', { boosterMultiplier: booster, boosterLevel: 3 })} connection="connected" busy={false} notice="" onCashout={() => {}} onFairness={() => {}} onReconnect={() => {}} />)
    expect(screen.getByTestId('booster-marker')).toHaveTextContent(`×${booster}`)
    expect(screen.getByTestId('booster-state')).toHaveTextContent('позиция открыта')
  })
  it('does not render a marker for ×1', () => {
    render(<Flight round={round()} connection="connected" busy={false} notice="" onCashout={() => {}} onFairness={() => {}} onReconnect={() => {}} />)
    expect(screen.queryByTestId('booster-marker')).not.toBeInTheDocument()
  })
  it('disables unaffordable bets and blocks start for an unaffordable selected stake', () => {
    render(<Setup theme="GREEN" onTheme={() => {}} catalog={mockCatalog} stake={100} onStake={() => {}} booster={1} onBooster={() => {}} balance={50} busy={false} onStart={() => {}} onRules={() => {}} onHistory={() => {}} />)
    expect(screen.getByRole('radio', { name: /100.*×1/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Начать полёт/i })).toBeDisabled()
    expect(screen.getByText(/Недостаточно бонусов/i)).toBeInTheDocument()
  })
})

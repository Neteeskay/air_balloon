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
  it('keeps cashout visible but disabled before level one', () => {
    render(<Flight round={round()} connection="connected" busy={false} notice="" onCashout={() => {}} onFairness={() => {}} onReconnect={() => {}} />)
    expect(screen.getByRole('button', { name: /Забрать/i })).toBeDisabled()
  })
  it('enables cashout after level one', () => {
    render(<Flight round={round('GREEN', { currentLevel: 1, currentMultiplier: 1.2, cashoutAvailable: true })} connection="connected" busy={false} notice="" onCashout={vi.fn()} onFairness={() => {}} onReconnect={() => {}} />)
    expect(screen.getByRole('button', { name: /Забрать/i })).toBeEnabled()
  })
  it('disables unaffordable bets and blocks start for an unaffordable selected stake', () => {
    render(<Setup theme="GREEN" onTheme={() => {}} catalog={mockCatalog} stake={100} onStake={() => {}} booster={1} onBooster={() => {}} balance={50} busy={false} onStart={() => {}} onRules={() => {}} onHistory={() => {}} />)
    expect(screen.getByRole('button', { name: '100' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Начать полёт/i })).toBeDisabled()
    expect(screen.getByText(/Недостаточно бонусов/i)).toBeInTheDocument()
  })
})

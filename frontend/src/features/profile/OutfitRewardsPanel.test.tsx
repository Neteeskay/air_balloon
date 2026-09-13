import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { OutfitRewardStatus } from '../../api/types'
import { OutfitRewardsPanel } from './OutfitRewardsPanel'

const reward = (overrides: Partial<OutfitRewardStatus> = {}): OutfitRewardStatus => ({
  code: 'SKY_TRAVELER',
  title: 'Небесный путешественник',
  rewardAmount: 500,
  completed: false,
  claimed: false,
  claimedAt: null,
  ...overrides,
})

describe('OutfitRewardsPanel', () => {
  it('shows an independent loading state', () => {
    render(<OutfitRewardsPanel state={{ status: 'loading', items: [] }} />)
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем награды')
  })

  it('renders an incomplete outfit from the backend response', () => {
    render(<OutfitRewardsPanel state={{ status: 'ready', items: [reward()] }} />)
    expect(screen.getByText('Небесный путешественник')).toBeInTheDocument()
    expect(screen.getByText('В процессе')).toBeInTheDocument()
    expect(screen.getByText('Комплект ещё не собран')).toBeInTheDocument()
  })

  it('renders a completed outfit that has not been claimed', () => {
    render(<OutfitRewardsPanel state={{ status: 'ready', items: [reward({ completed: true })] }} />)
    expect(screen.getByText('Выполнено')).toBeInTheDocument()
    expect(screen.getByText('Комплект собран')).toBeInTheDocument()
  })

  it('renders the claimed state', () => {
    render(<OutfitRewardsPanel state={{ status: 'ready', items: [reward({ completed: true, claimed: true, claimedAt: '2026-09-13T10:00:00Z' })] }} />)
    expect(screen.getByText('Получено')).toBeInTheDocument()
  })

  it('renders the honest empty state', () => {
    render(<OutfitRewardsPanel state={{ status: 'ready', items: [] }} />)
    expect(screen.getByText('Награды за образы пока недоступны.')).toBeInTheDocument()
  })

  it('renders an error and retries through the supplied loader', () => {
    const retry = vi.fn()
    render(<OutfitRewardsPanel state={{ status: 'error', items: [] }} onRetry={retry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Не удалось загрузить награды за образы')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(retry).toHaveBeenCalledOnce()
  })

  it('displays the reward value received from the backend', () => {
    render(<OutfitRewardsPanel state={{ status: 'ready', items: [reward({ rewardAmount: 1234 })] }} />)
    expect(screen.getByText((_, element) => element?.tagName === 'STRONG' && element.textContent === '+1 234 бонусов')).toBeInTheDocument()
  })

  it('renders multiple server definitions without assuming a single outfit', () => {
    render(<OutfitRewardsPanel state={{ status: 'ready', items: [reward(), reward({ code: 'SUNHAT_EXPLORER', title: 'Исследователь', rewardAmount: 200 })] }} />)
    expect(screen.getByText('Небесный путешественник')).toBeInTheDocument()
    expect(screen.getByText('Исследователь')).toBeInTheDocument()
  })
})

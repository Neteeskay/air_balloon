import { act, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Api, HistoryItem, HistoryPage, User } from '../../../api/types'
import { GameHistoryStrip } from './GameHistoryStrip'

const item = (roundId: string, completedAt: string, values: Partial<HistoryItem>): HistoryItem => ({
  roundId,
  completedAt,
  theme: 'GREEN',
  betAmount: 100,
  boosterMultiplier: 1,
  crashMultiplier: 1,
  winAmount: 0,
  score: 0,
  result: 'LOSS',
  ...values,
})

const page = (items: HistoryItem[]): HistoryPage => ({ items, page: 0, size: 10, total: items.length })
const apiWithHistory = (getGlobalHistory: Api['history']['getGlobalHistory']) => ({
  history: { getGlobalHistory },
}) as unknown as Api
const currentUser: User = { id: 'user-1', name: 'Анна Ветрова', login: 'anna', initials: 'АВ', color: '#4a9bff' }

afterEach(() => vi.useRealTimers())

describe('game history strip', () => {
  it('renders the ten latest global rounds and keeps the newest result on the right', async () => {
    const items = [
      item('newest', '2026-09-13T10:02:00Z', { result: 'WIN', cashoutMultiplier: 2.15, crashMultiplier: 4.8 }),
      item('middle', '2026-09-13T10:01:00Z', { displayName: 'Анна Ветрова', crashMultiplier: 0.95 }),
      item('oldest', '2026-09-13T10:00:00Z', { crashMultiplier: 4.3 }),
    ]
    const getGlobalHistory = vi.fn().mockResolvedValue(page(items))
    render(<GameHistoryStrip api={apiWithHistory(getGlobalHistory)} currentUser={currentUser} />)

    const strip = screen.getByRole('region', { name: 'Прошлые игры' })
    await waitFor(() => expect(within(strip).getByText('2.15')).toBeInTheDocument())
    expect(getGlobalHistory).toHaveBeenCalledWith(0, 10)
    expect(within(strip).getAllByText(/^\d+\.\d{2}$/).map((node) => node.textContent)).toEqual(['4.30', '0.95', '2.15'])
    expect(within(strip).getByText('2.15')).toHaveClass('is-high')
    expect(within(strip).getByText('0.95')).toHaveClass('is-current-player')
  })

  it('refreshes the global history while the betting page stays open', async () => {
    vi.useFakeTimers()
    const getGlobalHistory = vi.fn()
      .mockResolvedValueOnce(page([item('first', '2026-09-13T10:00:00Z', { crashMultiplier: 1.2 })]))
      .mockResolvedValueOnce(page([item('second', '2026-09-13T10:01:00Z', { crashMultiplier: 5.1 })]))
    render(<GameHistoryStrip api={apiWithHistory(getGlobalHistory)} />)

    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('1.20')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(screen.getByText('5.10')).toBeInTheDocument()
    expect(screen.queryByText('1.20')).not.toBeInTheDocument()
    expect(getGlobalHistory).toHaveBeenCalledTimes(2)
  })

  it('keeps the last successful values when a background refresh fails', async () => {
    vi.useFakeTimers()
    const getGlobalHistory = vi.fn()
      .mockResolvedValueOnce(page([item('first', '2026-09-13T10:00:00Z', { crashMultiplier: 1.45 })]))
      .mockRejectedValueOnce(new Error('Сервер недоступен'))
    render(<GameHistoryStrip api={apiWithHistory(getGlobalHistory)} />)

    await act(async () => { await Promise.resolve() })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    expect(screen.getByText('1.45')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Сервер недоступен')
  })
})

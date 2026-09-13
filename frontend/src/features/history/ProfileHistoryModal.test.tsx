import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Api, HistoryPage } from '../../api/types'
import { ProfileHistoryModal } from './ProfileHistoryModal'

const history: HistoryPage = {
  page: 0,
  size: 50,
  total: 2,
  items: [
    { roundId: 'r-1', displayName: 'SkyMira', theme: 'RED', betAmount: 100, boosterMultiplier: 1, cashoutMultiplier: 4.62, crashMultiplier: 5.1, winAmount: 462, score: 300, result: 'WIN', completedAt: '2026-09-13T10:42:00Z' },
    { roundId: 'r-2', displayName: 'Alex', theme: 'GREEN', betAmount: 250, boosterMultiplier: 2, crashMultiplier: 1.35, winAmount: 0, score: 100, result: 'LOSS', completedAt: '2026-09-13T10:41:00Z' },
  ],
}

describe('profile history modal', () => {
  it('loads global history and filters real rows by theme', async () => {
    const getGlobalHistory = vi.fn().mockResolvedValue(history)
    const api = { history: { getGlobalHistory } } as unknown as Api
    render(<ProfileHistoryModal api={api} onClose={() => undefined} />)

    const dialog = await screen.findByRole('dialog', { name: /История игр/ })
    expect(getGlobalHistory).toHaveBeenCalledWith(0, 50)
    expect(within(dialog).getByText('SkyMira')).toBeInTheDocument()
    expect(within(dialog).getByText('Alex')).toBeInTheDocument()
    expect(within(dialog).getAllByText('×4.62').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(within(dialog).getByRole('tab', { name: /Красный/ }))
    expect(within(dialog).getByText('SkyMira')).toBeInTheDocument()
    expect(within(dialog).queryByText('Alex')).not.toBeInTheDocument()
  })

  it('offers a retry when the backend request fails', async () => {
    const getGlobalHistory = vi.fn().mockRejectedValueOnce(new Error('Сервер недоступен')).mockResolvedValue(history)
    const api = { history: { getGlobalHistory } } as unknown as Api
    render(<ProfileHistoryModal api={api} onClose={() => undefined} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Сервер недоступен')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(screen.getByText('SkyMira')).toBeInTheDocument())
    expect(getGlobalHistory).toHaveBeenCalledTimes(2)
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Api } from '../../api/types'
import { RealProfilePage } from './RealProfilePage'

vi.mock('../avatar/AvatarProfile', () => ({
  AvatarProfile: ({ balance, onSave, puzzles = [] }: { balance: number; onSave: (name: string, equipped: { headId: string; neckId: string }) => Promise<void>; puzzles?: Array<{ id: string; name: string; totalFragments: number; rewardName?: string }> }) => <main>
    <span>balance:{balance}</span>
    {puzzles.map(puzzle => <span key={puzzle.id}>{puzzle.id}:{puzzle.name}:{puzzle.totalFragments}:{puzzle.rewardName}</span>)}
    <button type="button" onClick={() => { void onSave('Пушок', { headId: 'sunhat', neckId: 'cloud-scarf' }) }}>Сохранить образ</button>
  </main>,
}))

afterEach(() => vi.restoreAllMocks())

describe('RealProfilePage profile binding', () => {
  it('passes backend-owned puzzle metadata and reward names to Profile UI', async () => {
    const api = {
      profile: {
        get: vi.fn().mockResolvedValue({
          user: { displayName: 'Макс', gameScore: 0 },
          avatar: { equipped: { headId: 'AVIATOR', neckId: 'BOW' } },
          puzzles: [
            { id: 'PUZZLE_1', name: 'Вокруг света', totalFragments: 12, collectedFragments: 11, completed: false, rewardClothingId: 'CLOUD_SCARF', active: true },
            { id: 'PUZZLE_2', name: 'Космическая экспедиция', totalFragments: 8, collectedFragments: 7, completed: false, rewardClothingId: 'SPACE_HAT', active: true },
            { id: 'PUZZLE_3', name: 'Небесное путешествие', totalFragments: 6, collectedFragments: 5, completed: false, rewardClothingId: 'TRAVELER_COSTUME', active: true },
          ],
          wardrobe: [],
        }),
        wardrobe: vi.fn().mockResolvedValue([
          { id: 'CLOUD_SCARF', displayName: 'Облачный шарфик', active: true, unlocked: false },
          { id: 'SPACE_HAT', displayName: 'Космическая шапка', active: true, unlocked: false },
          { id: 'TRAVELER_COSTUME', displayName: 'Костюм путешественника', active: true, unlocked: false },
        ]),
        equip: vi.fn(),
      },
      history: { getPersonalHistory: vi.fn().mockResolvedValue({ items: [], total: 0 }) },
      economy: { getBalance: vi.fn() },
    } as unknown as Api

    render(<RealProfilePage api={api} user={{ id: 'maks', name: 'Макс', login: 'maks', initials: 'М', color: '#fff' }} balance={5000} onClose={() => undefined} />)

    expect(await screen.findByText('puzzle-1:Вокруг света:12:Облачный шарфик')).toBeInTheDocument()
    expect(screen.getByText('puzzle-2:Космическая экспедиция:8:Космическая шапка')).toBeInTheDocument()
    expect(screen.getByText('puzzle-3:Небесное путешествие:6:Костюм путешественника')).toBeInTheDocument()
  })

  it('refreshes canonical balance after a successful equipment update', async () => {
    const equip = vi.fn().mockResolvedValue({ balanceAfter: 999999 })
    const getBalance = vi.fn().mockResolvedValue({ bonusBalance: 5010, gameScore: 0 })
    const api = {
      profile: {
        get: vi.fn().mockResolvedValue({ user: { displayName: 'Макс', gameScore: 0 }, avatar: { equipped: { headId: 'AVIATOR', neckId: 'BOW' } }, puzzles: [], wardrobe: [] }),
        wardrobe: vi.fn().mockResolvedValue([]),
        equip,
      },
      history: { getPersonalHistory: vi.fn().mockResolvedValue({ items: [], total: 0 }) },
      economy: { getBalance },
    } as unknown as Api

    render(<RealProfilePage api={api} user={{ id: 'maks', name: 'Макс', login: 'maks', initials: 'М', color: '#fff' }} balance={5000} onClose={() => undefined} />)
    await screen.findByText('balance:5000')

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить образ' }))

    expect(equip).toHaveBeenCalledWith('SUNHAT', 'CLOUD_SCARF')
    await waitFor(() => expect(getBalance).toHaveBeenCalledOnce())
    expect(await screen.findByText('balance:5010')).toBeInTheDocument()
    expect(screen.queryByText('balance:6234')).not.toBeInTheDocument()
  })
})

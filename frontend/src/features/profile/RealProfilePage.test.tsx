import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Api, OutfitRewardStatus } from '../../api/types'
import { RealProfilePage } from './RealProfilePage'

vi.mock('../avatar/AvatarProfile', () => ({
  AvatarProfile: ({ balance, outfitRewards, onSave }: { balance: number; outfitRewards: { status: string; items: OutfitRewardStatus[] }; onSave: (name: string, equipped: { headId: string; neckId: string }) => Promise<void> }) => <main>
    <span>balance:{balance}</span>
    <span>rewards:{outfitRewards.status}:{outfitRewards.items.map((item) => item.code).join(',')}</span>
    <button type="button" onClick={() => { void onSave('Пушок', { headId: 'sunhat', neckId: 'cloud-scarf' }) }}>Сохранить образ</button>
  </main>,
}))

afterEach(() => vi.restoreAllMocks())

describe('RealProfilePage outfit reward binding', () => {
  it('refetches rewards and canonical balance after a successful equipment update', async () => {
    const before: OutfitRewardStatus[] = [{ code: 'SKY_TRAVELER', title: 'Небесный путешественник', rewardAmount: 1234, completed: false, claimed: false, claimedAt: null }]
    const after: OutfitRewardStatus[] = [{ ...before[0], completed: true, claimed: true, claimedAt: '2026-09-13T10:00:00Z' }]
    const getOutfitRewards = vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after)
    const equip = vi.fn().mockResolvedValue({ balanceAfter: 999999 })
    const getBalance = vi.fn().mockResolvedValue({ bonusBalance: 5010, gameScore: 0 })
    const api = {
      profile: {
        get: vi.fn().mockResolvedValue({ user: { displayName: 'Макс', gameScore: 0 }, avatar: { equipped: { headId: 'AVIATOR', neckId: 'BOW' } }, puzzles: [], wardrobe: [] }),
        wardrobe: vi.fn().mockResolvedValue([]),
        getOutfitRewards,
        equip,
      },
      history: { getPersonalHistory: vi.fn().mockResolvedValue({ items: [], total: 0 }) },
      economy: { getBalance },
    } as unknown as Api

    render(<RealProfilePage api={api} user={{ id: 'maks', name: 'Макс', login: 'maks', initials: 'М', color: '#fff' }} balance={5000} onClose={() => undefined} />)
    await screen.findByText('rewards:ready:SKY_TRAVELER')

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить образ' }))

    await waitFor(() => expect(getOutfitRewards).toHaveBeenCalledTimes(2))
    expect(equip).toHaveBeenCalledWith('SUNHAT', 'CLOUD_SCARF')
    expect(getBalance).toHaveBeenCalledOnce()
    expect(await screen.findByText('balance:5010')).toBeInTheDocument()
    expect(screen.queryByText('balance:6234')).not.toBeInTheDocument()
  })
})

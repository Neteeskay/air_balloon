import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEMO_REWARD_CLOTHING_ID,
  EMPTY_MOCK_STATE,
  beginMockRound,
  clearMockRound,
  createMockUser,
  finishMockRound,
  readMockState,
  saveMockAvatar,
  writeMockState,
  type MockGameState,
} from './mockGame'

function readyState(balance = 500): MockGameState {
  return {
    ...EMPTY_MOCK_STATE,
    currentUser: { ...createMockUser({ userId: 'demo', displayName: 'Demo' }), balance },
    selectedTheme: 'green',
  }
}

describe('mock game adapter', () => {
  beforeEach(() => window.sessionStorage.clear())

  it('deducts the stake and creates a round with the selected booster', () => {
    const next = beginMockRound(readyState(), 15, 2)
    expect(next.currentUser?.balance).toBe(485)
    expect(next.mockRound).toMatchObject({ theme: 'green', stake: 15, booster: 2 })
  })

  it('awards one puzzle fragment after WIN and none after LOSS', () => {
    const winState = readyState()
    winState.currentUser!.puzzles[0].collectedFragments = 2
    const win = finishMockRound(beginMockRound(winState, 15, 2), 'win')
    expect(win.mockResult?.reward).toMatchObject({ count: 1, collectedFragments: 3, totalFragments: 6 })

    const lossState = readyState()
    lossState.currentUser!.puzzles[0].collectedFragments = 2
    const loss = finishMockRound(beginMockRound(lossState, 15, 2), 'loss')
    expect(loss.mockResult?.reward).toMatchObject({ count: 0, collectedFragments: 2, totalFragments: 6 })
  })

  it('creates a WIN result, credits payout and keeps lottery tickets separate', () => {
    const result = finishMockRound(beginMockRound(readyState(), 15, 2), 'win')
    expect(result.mockResult).toMatchObject({ result: 'win', betAmount: 15, payoutAmount: 33 })
    expect(result.currentUser?.balance).toBe(518)
    expect(result.currentUser?.score).toBe(1520)
    expect(result.currentUser?.lotteryTickets).toBe(4)
  })

  it('completes the deterministic 5/6 puzzle and unlocks clothing once', () => {
    const completed = finishMockRound(beginMockRound(readyState(), 15, 2), 'win')
    expect(completed.currentUser?.puzzles[0]).toMatchObject({ collectedFragments: 6, completed: true })
    expect(completed.currentUser?.unlockedClothingIds).toContain(DEMO_REWARD_CLOTHING_ID)
    expect(completed.mockResult?.reward).toMatchObject({ puzzleCompleted: true, clothingReward: { id: DEMO_REWARD_CLOTHING_ID } })

    const duplicateAttempt = finishMockRound(completed, 'loss')
    expect(duplicateAttempt).toBe(completed)

    const nextRound = finishMockRound(beginMockRound(clearMockRound(completed), 15, 2), 'loss')
    expect(nextRound.mockResult?.reward).toMatchObject({ count: 0, puzzleCompleted: false })
    expect(nextRound.currentUser?.unlockedClothingIds.filter((id) => id === DEMO_REWARD_CLOTHING_ID)).toHaveLength(1)
  })

  it('blocks locked clothing and equips unlocked clothing', () => {
    const locked = readyState()
    const blocked = saveMockAvatar(locked, 'Облачко', { headId: 'aviator', neckId: DEMO_REWARD_CLOTHING_ID })
    expect(blocked.currentUser?.equippedClothing.neckId).toBe('bow')

    const unlocked = finishMockRound(beginMockRound(readyState(), 15, 1), 'win')
    const equipped = saveMockAvatar(unlocked, 'Облачко', { headId: 'sunhat', neckId: DEMO_REWARD_CLOTHING_ID })
    expect(equipped.currentUser).toMatchObject({
      petName: 'Облачко',
      equippedClothing: { headId: 'sunhat', neckId: DEMO_REWARD_CLOTHING_ID },
    })
  })

  it('persists puzzle, inventory and equipped outfit across a refresh', () => {
    const unlocked = finishMockRound(beginMockRound(readyState(), 15, 1), 'win')
    const equipped = saveMockAvatar(unlocked, 'Облачко', { headId: 'aviator', neckId: DEMO_REWARD_CLOTHING_ID })
    writeMockState(equipped)
    const restored = readMockState()
    expect(restored.currentUser?.puzzles[0]).toMatchObject({ collectedFragments: 6, completed: true })
    expect(restored.currentUser?.unlockedClothingIds).toContain(DEMO_REWARD_CLOTHING_ID)
    expect(restored.currentUser?.equippedClothing.neckId).toBe(DEMO_REWARD_CLOTHING_ID)
  })

  it('does not start an unaffordable bet', () => {
    const state = readyState(10)
    expect(beginMockRound(state, 15, 2)).toBe(state)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEMO_REWARD_CLOTHING_ID,
  EMPTY_MOCK_STATE,
  applyFortunePrize,
  beginMockRound,
  clearMockRound,
  createMockUser,
  finishMockRound,
  readMockState,
  saveMockAvatar,
  writeMockState,
  type MockGameState,
} from './mockGame'
import { FORTUNE_WHEEL_PRIZES } from './fortuneWheelPrizes'

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
    expect(next.roundCount).toBe(1)
    expect(next.mockRound).toMatchObject({ theme: 'green', stake: 15, booster: 2 })
  })

  it('awards one puzzle fragment after WIN and none after LOSS', () => {
    const winState = readyState()
    winState.currentUser!.puzzles[0].collectedFragments = 2
    const win = finishMockRound(beginMockRound(winState, 15, 2), 'win')
    expect(win.mockResult?.reward).toMatchObject({ count: 1, collectedFragments: 3, totalFragments: 12 })

    const lossState = readyState()
    lossState.currentUser!.puzzles[0].collectedFragments = 2
    const loss = finishMockRound(beginMockRound(lossState, 15, 2), 'loss')
    expect(loss.mockResult?.reward).toMatchObject({ count: 0, collectedFragments: 2, totalFragments: 12 })
  })

  it('creates a WIN result, credits payout and keeps lottery tickets separate', () => {
    const result = finishMockRound(beginMockRound(readyState(), 15, 2), 'win')
    expect(result.mockResult).toMatchObject({ result: 'win', betAmount: 15, payoutAmount: 33 })
    expect(result.currentUser?.balance).toBe(518)
    expect(result.currentUser?.score).toBe(1520)
    expect(result.currentUser?.lotteryTickets).toBe(4)
  })

  it('completes the puzzle and unlocks clothing once', () => {
    const state = readyState()
    state.currentUser!.puzzles[0].collectedFragments = 11
    const completed = finishMockRound(beginMockRound(state, 15, 2), 'win')
    expect(completed.currentUser?.puzzles[0]).toMatchObject({ collectedFragments: 12, completed: true })
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

    const almostComplete = readyState()
    almostComplete.currentUser!.puzzles[0].collectedFragments = 11
    const unlocked = finishMockRound(beginMockRound(almostComplete, 15, 1), 'win')
    const equipped = saveMockAvatar(unlocked, 'Облачко', { headId: 'sunhat', neckId: DEMO_REWARD_CLOTHING_ID })
    expect(equipped.currentUser).toMatchObject({
      petName: 'Облачко',
      equippedClothing: { headId: 'sunhat', neckId: DEMO_REWARD_CLOTHING_ID },
    })
  })

  it('persists puzzle, inventory and equipped outfit across a refresh', () => {
    const state = readyState()
    state.currentUser!.puzzles[0].collectedFragments = 11
    const unlocked = finishMockRound(beginMockRound(state, 15, 1), 'win')
    const equipped = saveMockAvatar(unlocked, 'Облачко', { headId: 'aviator', neckId: DEMO_REWARD_CLOTHING_ID })
    writeMockState(equipped)
    const restored = readMockState()
    expect(restored.currentUser?.puzzles[0]).toMatchObject({ collectedFragments: 12, completed: true })
    expect(restored.currentUser?.unlockedClothingIds).toContain(DEMO_REWARD_CLOTHING_ID)
    expect(restored.currentUser?.equippedClothing.neckId).toBe(DEMO_REWARD_CLOTHING_ID)
  })

  it('does not start an unaffordable bet', () => {
    const state = readyState(10)
    expect(beginMockRound(state, 15, 2)).toBe(state)
  })

  it('applies every fortune prize type to the mock user', () => {
    const ratingPrize = FORTUNE_WHEEL_PRIZES.find((prize) => prize.type === 'rating')!
    const coinPrize = FORTUNE_WHEEL_PRIZES.find((prize) => prize.type === 'coins')!
    const puzzlePrize = FORTUNE_WHEEL_PRIZES.find((prize) => prize.type === 'puzzle')!
    const state = readyState()
    state.currentUser!.puzzles[0].collectedFragments = 11

    const withRating = applyFortunePrize(state, ratingPrize)
    expect(withRating.currentUser?.score).toBe(1280 + ratingPrize.amount)

    const withCoins = applyFortunePrize(withRating, coinPrize)
    expect(withCoins.currentUser?.balance).toBe(500 + coinPrize.amount)

    const withPuzzle = applyFortunePrize(withCoins, puzzlePrize)
    expect(withPuzzle.currentUser?.puzzles[0]).toMatchObject({ collectedFragments: 12, completed: true })
    expect(withPuzzle.currentUser?.unlockedClothingIds).toContain(DEMO_REWARD_CLOTHING_ID)
  })

  it('keeps exactly one rare puzzle sector on the fortune wheel', () => {
    expect(FORTUNE_WHEEL_PRIZES.filter((prize) => prize.type === 'puzzle')).toHaveLength(1)
    expect(FORTUNE_WHEEL_PRIZES.filter((prize) => prize.type === 'rating').length).toBeGreaterThan(1)
    expect(FORTUNE_WHEEL_PRIZES.filter((prize) => prize.type === 'coins').length).toBeGreaterThan(1)
  })
})

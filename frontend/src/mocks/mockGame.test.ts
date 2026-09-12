import { describe, expect, it } from 'vitest'
import {
  EMPTY_MOCK_STATE,
  beginMockRound,
  createMockUser,
  finishMockRound,
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
  it('deducts the stake and creates a round with the selected booster', () => {
    const next = beginMockRound(readyState(), 15, 2)
    expect(next.currentUser?.balance).toBe(485)
    expect(next.mockRound).toMatchObject({ theme: 'green', stake: 15, booster: 2 })
  })

  it('creates a WIN result and credits the mock payout', () => {
    const result = finishMockRound(beginMockRound(readyState(), 15, 2), 'win')
    expect(result.mockResult).toMatchObject({ result: 'win', betAmount: 15, payoutAmount: 33 })
    expect(result.currentUser?.balance).toBe(518)
    expect(result.currentUser?.score).toBe(1520)
  })

  it('creates a LOSS result without crediting a payout', () => {
    const result = finishMockRound(beginMockRound(readyState(), 15, 2), 'loss')
    expect(result.mockResult).toMatchObject({ result: 'loss', betAmount: 15, payoutAmount: undefined })
    expect(result.currentUser?.balance).toBe(485)
  })

  it('does not start an unaffordable bet', () => {
    const state = readyState(10)
    expect(beginMockRound(state, 15, 2)).toBe(state)
  })
})

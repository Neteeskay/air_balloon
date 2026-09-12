import type { CurrentUser } from '../types/auth'
import type { ResultScreenData, RoundOutcome } from '../types/result'

export type MockTheme = 'green' | 'red'
export type MockBooster = 1 | 2 | 3 | 4

export type MockUser = CurrentUser & {
  balance: number
  score: number
  lotteryTickets: number
}

export type MockRound = {
  id: string
  theme: MockTheme
  stake: number
  booster: MockBooster
}

export type MockGameState = {
  currentUser: MockUser | null
  selectedTheme: MockTheme | null
  selectedStake: number | null
  selectedBooster: MockBooster | null
  mockRound: MockRound | null
  mockResult: ResultScreenData | null
}

export const MOCK_STATE_KEY = 'air-balloon:full-mock:v1'

export const EMPTY_MOCK_STATE: MockGameState = {
  currentUser: null,
  selectedTheme: null,
  selectedStake: null,
  selectedBooster: null,
  mockRound: null,
  mockResult: null,
}

export function createMockUser(user: CurrentUser): MockUser {
  return { ...user, balance: 500, score: 1280, lotteryTickets: 3 }
}

export function readMockState(): MockGameState {
  try {
    const raw = window.sessionStorage.getItem(MOCK_STATE_KEY)
    if (!raw) return EMPTY_MOCK_STATE
    const parsed = JSON.parse(raw) as Partial<MockGameState>
    const user = parsed.currentUser
    if (!user || typeof user.userId !== 'string' || typeof user.balance !== 'number') return EMPTY_MOCK_STATE
    return { ...EMPTY_MOCK_STATE, ...parsed, currentUser: user }
  } catch {
    return EMPTY_MOCK_STATE
  }
}

export function writeMockState(state: MockGameState) {
  try {
    window.sessionStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state))
  } catch {
    // In-memory navigation continues to work when storage is unavailable.
  }
}

export function beginMockRound(
  state: MockGameState,
  stake: number,
  booster: MockBooster,
): MockGameState {
  if (!state.currentUser || !state.selectedTheme || stake <= 0 || stake > state.currentUser.balance) return state

  return {
    ...state,
    currentUser: { ...state.currentUser, balance: state.currentUser.balance - stake },
    selectedStake: stake,
    selectedBooster: booster,
    mockRound: {
      id: `mock-${Date.now()}`,
      theme: state.selectedTheme,
      stake,
      booster,
    },
    mockResult: null,
  }
}

export function finishMockRound(state: MockGameState, outcome: RoundOutcome): MockGameState {
  if (!state.currentUser || !state.mockRound) return state

  const { currentUser, mockRound } = state
  const cashoutMultiplier = outcome === 'win' ? 2.2 : undefined
  const payoutAmount = cashoutMultiplier ? Math.round(mockRound.stake * cashoutMultiplier) : 0
  const earnedPoints = outcome === 'win' ? 120 * mockRound.booster : 20 * mockRound.booster
  const nextUser: MockUser = {
    ...currentUser,
    balance: currentUser.balance + payoutAmount,
    score: currentUser.score + earnedPoints,
    lotteryTickets: currentUser.lotteryTickets + (outcome === 'win' ? 1 : 0),
  }

  return {
    ...state,
    currentUser: nextUser,
    mockResult: {
      roundId: mockRound.id,
      result: outcome,
      theme: mockRound.theme,
      betAmount: mockRound.stake,
      payoutAmount: outcome === 'win' ? payoutAmount : undefined,
      bonusBalance: nextUser.balance,
      cashoutMultiplier,
      crashMultiplier: outcome === 'win' ? 3.14 : 1.47,
      potentialMaxMultiplier: outcome === 'win' ? 3.14 : undefined,
      earnedPoints,
      reward: { count: outcome === 'win' ? mockRound.booster : 0, label: 'Фрагмент пазла' },
      playerName: nextUser.displayName,
      canRepeatBet: nextUser.balance >= mockRound.stake,
    },
  }
}

export function clearMockRound(state: MockGameState): MockGameState {
  return { ...state, mockRound: null, mockResult: null }
}

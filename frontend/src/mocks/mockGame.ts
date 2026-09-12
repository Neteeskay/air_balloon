import type { CurrentUser } from '../types/auth'
import type { ResultScreenData, RoundOutcome } from '../types/result'

export type MockTheme = 'green' | 'red'
export type MockBooster = 1 | 2 | 3 | 4

export type MockPuzzle = {
  id: string
  name: string
  totalFragments: number
  collectedFragments: number
  rewardClothingId: string
  completed: boolean
}

export type MockEquippedClothing = {
  headId: string
  neckId: string
}

export type MockUser = CurrentUser & {
  balance: number
  score: number
  lotteryTickets: number
  petName: string
  puzzles: MockPuzzle[]
  unlockedClothingIds: string[]
  equippedClothing: MockEquippedClothing
}

export type MockRound = {
  id: string
  theme: MockTheme
  stake: number
  booster: MockBooster
  startedAt: number
  crashAfterMs: number
  crashMultiplier: number
  cashoutMultiplier: number | null
  status: 'flying' | 'cashed-out' | 'finished'
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
export const DEMO_PUZZLE_ID = 'sky-journey'
export const DEMO_REWARD_CLOTHING_ID = 'cloud-scarf'

const DEFAULT_UNLOCKED_CLOTHING = ['aviator', 'sunhat', 'bow']
const DEFAULT_EQUIPPED_CLOTHING: MockEquippedClothing = { headId: 'aviator', neckId: 'bow' }

export const EMPTY_MOCK_STATE: MockGameState = {
  currentUser: null,
  selectedTheme: null,
  selectedStake: null,
  selectedBooster: null,
  mockRound: null,
  mockResult: null,
}

function createDemoPuzzle(): MockPuzzle {
  return {
    id: DEMO_PUZZLE_ID,
    name: 'Небесное путешествие',
    totalFragments: 6,
    collectedFragments: 5,
    rewardClothingId: DEMO_REWARD_CLOTHING_ID,
    completed: false,
  }
}

export function createMockUser(user: CurrentUser): MockUser {
  return {
    ...user,
    balance: 500,
    score: 1280,
    lotteryTickets: 3,
    petName: 'Пушок',
    puzzles: [createDemoPuzzle()],
    unlockedClothingIds: [...DEFAULT_UNLOCKED_CLOTHING],
    equippedClothing: { ...DEFAULT_EQUIPPED_CLOTHING },
  }
}

function normalizePuzzle(value: unknown): MockPuzzle {
  if (!value || typeof value !== 'object') return createDemoPuzzle()
  const candidate = value as Partial<MockPuzzle>
  const totalFragments = Number.isInteger(candidate.totalFragments) && Number(candidate.totalFragments) > 0
    ? Number(candidate.totalFragments)
    : 6
  const collectedFragments = Math.max(0, Math.min(totalFragments,
    Number.isInteger(candidate.collectedFragments) ? Number(candidate.collectedFragments) : 5,
  ))
  return {
    id: typeof candidate.id === 'string' ? candidate.id : DEMO_PUZZLE_ID,
    name: typeof candidate.name === 'string' ? candidate.name : 'Небесное путешествие',
    totalFragments,
    collectedFragments,
    rewardClothingId: typeof candidate.rewardClothingId === 'string' ? candidate.rewardClothingId : DEMO_REWARD_CLOTHING_ID,
    completed: collectedFragments === totalFragments,
  }
}

function normalizeMockUser(value: unknown): MockUser | null {
  if (!value || typeof value !== 'object') return null
  const user = value as Partial<MockUser>
  if (typeof user.userId !== 'string' || typeof user.displayName !== 'string' || typeof user.balance !== 'number') return null
  const unlocked = Array.isArray(user.unlockedClothingIds)
    ? user.unlockedClothingIds.filter((id): id is string => typeof id === 'string')
    : DEFAULT_UNLOCKED_CLOTHING
  const uniqueUnlocked = [...new Set([...DEFAULT_UNLOCKED_CLOTHING, ...unlocked])]
  const equipped = user.equippedClothing
  const headId = equipped && uniqueUnlocked.includes(equipped.headId) && ['aviator', 'sunhat'].includes(equipped.headId)
    ? equipped.headId
    : DEFAULT_EQUIPPED_CLOTHING.headId
  const neckId = equipped && uniqueUnlocked.includes(equipped.neckId) && ['bow', 'cloud-scarf'].includes(equipped.neckId)
    ? equipped.neckId
    : DEFAULT_EQUIPPED_CLOTHING.neckId
  return {
    userId: user.userId,
    displayName: user.displayName,
    balance: user.balance,
    score: typeof user.score === 'number' ? user.score : 1280,
    lotteryTickets: typeof user.lotteryTickets === 'number' ? user.lotteryTickets : 3,
    petName: typeof user.petName === 'string' && user.petName.trim() ? user.petName.trim().slice(0, 24) : 'Пушок',
    puzzles: Array.isArray(user.puzzles) && user.puzzles.length > 0 ? user.puzzles.map(normalizePuzzle) : [createDemoPuzzle()],
    unlockedClothingIds: uniqueUnlocked,
    equippedClothing: { headId, neckId },
  }
}

export function readMockState(): MockGameState {
  try {
    const raw = window.sessionStorage.getItem(MOCK_STATE_KEY)
    if (!raw) return EMPTY_MOCK_STATE
    const parsed = JSON.parse(raw) as Partial<MockGameState>
    const currentUser = normalizeMockUser(parsed.currentUser)
    if (!currentUser) return EMPTY_MOCK_STATE
    const parsedRound = parsed.mockRound
    const mockRound = parsedRound && typeof parsedRound === 'object'
      ? {
          id: typeof parsedRound.id === 'string' ? parsedRound.id : `mock-${Date.now()}`,
          theme: parsedRound.theme === 'red' ? 'red' as const : 'green' as const,
          stake: typeof parsedRound.stake === 'number' ? parsedRound.stake : 15,
          booster: [1, 2, 3, 4].includes(Number(parsedRound.booster)) ? Number(parsedRound.booster) as MockBooster : 1 as const,
          startedAt: typeof parsedRound.startedAt === 'number' ? parsedRound.startedAt : Date.now(),
          crashAfterMs: typeof parsedRound.crashAfterMs === 'number' ? parsedRound.crashAfterMs : 5600,
          crashMultiplier: typeof parsedRound.crashMultiplier === 'number' ? parsedRound.crashMultiplier : 1.47,
          cashoutMultiplier: typeof parsedRound.cashoutMultiplier === 'number' ? parsedRound.cashoutMultiplier : null,
          status: parsedRound.status === 'cashed-out' || parsedRound.status === 'finished' ? parsedRound.status : 'flying' as const,
        }
      : null
    return { ...EMPTY_MOCK_STATE, ...parsed, currentUser, mockRound }
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
      startedAt: Date.now(),
      // Deterministic UI fixture: the balloon reaches the crash point after a
      // short, refresh-safe flight. This is not production crash mathematics.
      crashAfterMs: state.selectedTheme === 'red' ? 6200 : 5600,
      crashMultiplier: 1.47,
      cashoutMultiplier: null,
      status: 'flying',
    },
    mockResult: null,
  }
}

export function finishMockRound(state: MockGameState, outcome: RoundOutcome): MockGameState {
  if (!state.currentUser || !state.mockRound) return state
  if (state.mockResult?.roundId === state.mockRound.id) return state

  const { currentUser, mockRound } = state
  const cashoutMultiplier = outcome === 'win' ? (mockRound.cashoutMultiplier ?? 2.2) : undefined
  const payoutAmount = cashoutMultiplier ? Math.round(mockRound.stake * cashoutMultiplier) : 0
  const earnedPoints = outcome === 'win' ? 120 * mockRound.booster : 20 * mockRound.booster
  const puzzleIndex = currentUser.puzzles.findIndex((puzzle) => !puzzle.completed)
  const puzzle = currentUser.puzzles[puzzleIndex] ?? currentUser.puzzles[0]
  // Product policy: only a successful cashout grants a puzzle fragment.
  const fragmentAwarded = outcome === 'win' && puzzleIndex >= 0
  const nextCollected = fragmentAwarded
    ? Math.min(puzzle.totalFragments, puzzle.collectedFragments + 1)
    : puzzle.collectedFragments
  const justCompleted = fragmentAwarded && nextCollected === puzzle.totalFragments
  const nextPuzzle: MockPuzzle = { ...puzzle, collectedFragments: nextCollected, completed: nextCollected === puzzle.totalFragments }
  const puzzles = currentUser.puzzles.map((value, index) => index === (puzzleIndex >= 0 ? puzzleIndex : 0) ? nextPuzzle : value)
  const unlockedClothingIds = justCompleted
    ? [...new Set([...currentUser.unlockedClothingIds, puzzle.rewardClothingId])]
    : currentUser.unlockedClothingIds
  const nextUser: MockUser = {
    ...currentUser,
    balance: currentUser.balance + payoutAmount,
    score: currentUser.score + earnedPoints,
    lotteryTickets: currentUser.lotteryTickets + (outcome === 'win' ? 1 : 0),
    puzzles,
    unlockedClothingIds,
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
      crashMultiplier: mockRound.crashMultiplier,
      potentialMaxMultiplier: outcome === 'win' ? mockRound.crashMultiplier : undefined,
      earnedPoints,
      reward: {
        count: fragmentAwarded ? 1 : 0,
        label: fragmentAwarded ? 'Получен фрагмент' : puzzle.completed ? 'Пазл уже собран' : 'Фрагмент не получен',
        puzzleName: puzzle.name,
        collectedFragments: nextCollected,
        totalFragments: puzzle.totalFragments,
        puzzleCompleted: justCompleted,
        clothingReward: justCompleted ? { id: DEMO_REWARD_CLOTHING_ID, name: 'Облачный шарфик' } : undefined,
      },
      playerName: nextUser.displayName,
      canRepeatBet: nextUser.balance >= mockRound.stake,
    },
  }
}

export function cashOutMockRound(state: MockGameState, multiplier: number): MockGameState {
  if (!state.mockRound || state.mockRound.status !== 'flying') return state
  const normalized = Math.max(1, Math.round(multiplier * 100) / 100)
  return {
    ...state,
    mockRound: { ...state.mockRound, cashoutMultiplier: normalized, status: 'cashed-out' },
  }
}

export function finishActiveMockRound(state: MockGameState): MockGameState {
  if (!state.mockRound || state.mockRound.status === 'finished') return state
  const outcome: RoundOutcome = state.mockRound.status === 'cashed-out' ? 'win' : 'loss'
  const next = finishMockRound(state, outcome)
  return next.mockRound ? { ...next, mockRound: { ...next.mockRound, status: 'finished' } } : next
}

export function saveMockAvatar(state: MockGameState, petName: string, equipped: MockEquippedClothing): MockGameState {
  if (!state.currentUser) return state
  const { currentUser } = state
  const headId = currentUser.unlockedClothingIds.includes(equipped.headId) && ['aviator', 'sunhat'].includes(equipped.headId)
    ? equipped.headId
    : currentUser.equippedClothing.headId
  const neckId = currentUser.unlockedClothingIds.includes(equipped.neckId) && ['bow', 'cloud-scarf'].includes(equipped.neckId)
    ? equipped.neckId
    : currentUser.equippedClothing.neckId
  return {
    ...state,
    currentUser: {
      ...currentUser,
      petName: petName.trim().slice(0, 24) || currentUser.petName,
      equippedClothing: { headId, neckId },
    },
  }
}

export function clearMockRound(state: MockGameState): MockGameState {
  return { ...state, mockRound: null, mockResult: null }
}

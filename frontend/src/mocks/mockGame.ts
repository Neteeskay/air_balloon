import type { CurrentUser } from '../types/auth'
import type { ResultScreenData, RoundOutcome } from '../types/result'
import type { FortuneWheelPrize } from './fortuneWheelPrizes'
import { PUZZLE_COLLECTION_MOCKS } from './puzzleCollection'

export type MockTheme = 'green' | 'red'
export type MockBooster = 1 | 2 | 3 | 4

export type MockPuzzle = {
  id: string
  name: string
  totalFragments: number
  collectedFragments: number
  rewardClothingId: string
  rewardName?: string
  completed: boolean
  locked?: boolean
}

export type MockEquippedClothing = {
  headId: string
  neckId: string
}

export type MockUser = CurrentUser & {
  balance: number
  favoriteTheme: MockTheme
  gamesPlayed: number
  score: number
  wins: number
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
  roundCount: number
  selectedTheme: MockTheme | null
  selectedStake: number | null
  selectedBooster: MockBooster | null
  mockRound: MockRound | null
  mockResult: ResultScreenData | null
}

export const MOCK_STATE_KEY = 'air-balloon:full-mock:v1'
export const DEMO_PUZZLE_ID = 'puzzle-1'
export const DEMO_REWARD_CLOTHING_ID = 'cloud-scarf'

const DEFAULT_UNLOCKED_CLOTHING = ['aviator', 'sunhat', 'bow']
const DEFAULT_EQUIPPED_CLOTHING: MockEquippedClothing = { headId: 'aviator', neckId: 'bow' }

export const EMPTY_MOCK_STATE: MockGameState = {
  currentUser: null,
  roundCount: 0,
  selectedTheme: null,
  selectedStake: null,
  selectedBooster: null,
  mockRound: null,
  mockResult: null,
}

function createDemoPuzzles(): MockPuzzle[] {
  return PUZZLE_COLLECTION_MOCKS.map((definition, index) => ({
    id: definition.id,
    name: definition.name,
    totalFragments: definition.totalFragments,
    collectedFragments: index === 0 ? 8 : 0,
    rewardClothingId: definition.rewardClothingId ?? '',
    rewardName: definition.rewardName,
    completed: false,
    locked: definition.locked,
  }))
}

export function createMockUser(user: CurrentUser): MockUser {
  return {
    ...user,
    balance: 500,
    favoriteTheme: 'red',
    gamesPlayed: 86,
    score: 1280,
    wins: 31,
    lotteryTickets: 3,
    petName: 'Пушок',
    puzzles: createDemoPuzzles(),
    unlockedClothingIds: [...DEFAULT_UNLOCKED_CLOTHING],
    equippedClothing: { ...DEFAULT_EQUIPPED_CLOTHING },
  }
}

function normalizePuzzle(value: unknown): MockPuzzle {
  if (!value || typeof value !== 'object') return createDemoPuzzles()[0]
  const candidate = value as Partial<MockPuzzle>
  const normalizedId = typeof candidate.id === 'string' ? candidate.id.trim().toLowerCase().replaceAll('_', '-') : ''
  const legacyDemo = normalizedId === 'sky-journey' || normalizedId === 'high-flight'
  const definition = PUZZLE_COLLECTION_MOCKS.find(item => item.id === (legacyDemo ? DEMO_PUZZLE_ID : normalizedId))
    ?? PUZZLE_COLLECTION_MOCKS[0]
  const totalFragments = definition.totalFragments
  const savedCollected = Number.isInteger(candidate.collectedFragments) ? Number(candidate.collectedFragments) : 8
  const oldTotal = Number.isInteger(candidate.totalFragments) && Number(candidate.totalFragments) > 0
    ? Number(candidate.totalFragments)
    : totalFragments
  const migratedCollected = legacyDemo && oldTotal !== totalFragments
    ? Math.round((savedCollected / oldTotal) * totalFragments)
    : savedCollected
  const collectedFragments = Math.max(0, Math.min(totalFragments,
    migratedCollected,
  ))
  return {
    id: definition.id,
    name: definition.name,
    totalFragments,
    collectedFragments,
    rewardClothingId: definition.rewardClothingId ?? '',
    rewardName: definition.rewardName,
    completed: collectedFragments === totalFragments,
    locked: definition.locked,
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
    favoriteTheme: user.favoriteTheme === 'green' ? 'green' : 'red',
    gamesPlayed: typeof user.gamesPlayed === 'number' ? user.gamesPlayed : 86,
    score: typeof user.score === 'number' ? user.score : 1280,
    wins: typeof user.wins === 'number' ? user.wins : 31,
    lotteryTickets: typeof user.lotteryTickets === 'number' ? user.lotteryTickets : 3,
    petName: typeof user.petName === 'string' && user.petName.trim() ? user.petName.trim().slice(0, 24) : 'Пушок',
    puzzles: Array.isArray(user.puzzles) && user.puzzles.length > 0 ? user.puzzles.map(normalizePuzzle) : createDemoPuzzles(),
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
    const roundCount = typeof parsed.roundCount === 'number' && parsed.roundCount >= 0
      ? Math.floor(parsed.roundCount)
      : 0
    return { ...EMPTY_MOCK_STATE, ...parsed, currentUser, mockRound, roundCount }
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
  options: { crashMultiplier?: number } = {},
): MockGameState {
  if (!state.currentUser || !state.selectedTheme || stake <= 0 || stake > state.currentUser.balance) return state

  return {
    ...state,
    roundCount: state.roundCount + 1,
    currentUser: {
      ...state.currentUser,
      balance: state.currentUser.balance - stake,
      favoriteTheme: state.selectedTheme,
      gamesPlayed: state.currentUser.gamesPlayed + 1,
    },
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
      crashMultiplier: options.crashMultiplier ?? 1.47,
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
    wins: currentUser.wins + (outcome === 'win' ? 1 : 0),
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
        clothingReward: justCompleted ? { id: puzzle.rewardClothingId, name: puzzle.rewardName ?? puzzle.rewardClothingId } : undefined,
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

export function applyFortunePrize(state: MockGameState, prize: FortuneWheelPrize): MockGameState {
  if (!state.currentUser) return state

  const { currentUser } = state
  if (prize.type === 'rating') {
    return { ...state, currentUser: { ...currentUser, score: currentUser.score + prize.amount } }
  }
  if (prize.type === 'coins') {
    return { ...state, currentUser: { ...currentUser, balance: currentUser.balance + prize.amount } }
  }

  const puzzleIndex = currentUser.puzzles.findIndex((puzzle) => !puzzle.completed)
  if (puzzleIndex < 0) return state

  const puzzle = currentUser.puzzles[puzzleIndex]
  const collectedFragments = Math.min(puzzle.totalFragments, puzzle.collectedFragments + prize.amount)
  const completed = collectedFragments === puzzle.totalFragments
  const puzzles = currentUser.puzzles.map((value, index) => index === puzzleIndex
    ? { ...value, collectedFragments, completed }
    : value)
  const unlockedClothingIds = completed
    ? [...new Set([...currentUser.unlockedClothingIds, puzzle.rewardClothingId])]
    : currentUser.unlockedClothingIds

  return {
    ...state,
    currentUser: { ...currentUser, puzzles, unlockedClothingIds },
  }
}

export function clearMockRound(state: MockGameState): MockGameState {
  return { ...state, mockRound: null, mockResult: null }
}

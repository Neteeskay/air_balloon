export type Theme = 'GREEN' | 'RED'
export type Preset = 'WIN' | 'LOSE' | 'BOOSTER' | 'RECONNECT'
export type Connection = 'connecting' | 'connected' | 'disconnected' | 'recovering'
export type User = { id: string; name: string; login: string; initials: string; color: string }
export type Wallet = { bonusBalance: number; gameScore: number; lotteryTicketCount?: number }
export type Scenario8Offer = { offerId: string; roundId: string; price: number; ticketCount: number; minWinAmount: number; expiresAt: string; status: 'AVAILABLE' | 'EXPIRED' | 'CONSUMED' }
export type Scenario8Purchase = { offerId: string; roundId: string; price: number; ticketCount: number; bonusBalance: number; lotteryTicketCount: number; replayed: boolean }
export type Catalog = {
  stakes: number[]; stakeRules: { minimum: number; maximum: number; decimalPlaces: number }
  boosters: number[]; levels: Record<Theme, number>; pointsPerLevel?: number; cashoutPoints?: number
  stakeOptions: Array<{ amount: number; boosterMultiplier: number; active: boolean }>
}
export type Fairness = { roundId: string; commitment: string; status: 'COMMITTED' | 'REVEALED'; serverSeed?: string; crashMultiplier?: number; boosterLevel?: number; verified?: boolean; canonicalInput?: string; algorithm?: string; format?: string; example?: boolean }
export type Round = {
  id: string; roundId: string; theme: Theme; betAmount: number; boosterMultiplier: number
  boosterActivated: boolean; boosterLevel?: number; currentMultiplier: number; currentLevel: number
  totalLevels: number; levelThresholds: number[]; cashoutAvailable: boolean; cashoutPerformed: boolean
  cashoutPreviewAmount?: number; cashoutMultiplier?: number; winAmount: number; roundScore: number
  status: 'RUNNING' | 'CASHED_OUT' | 'CRASHED' | 'FINISHED'; outcome?: 'CASHED_OUT' | 'LOSS'
  startedAt: string; timestamp: string; serverTime: string; finishedAt?: string; sequence: number
  fairnessCommitment: string; fairnessReveal?: Fairness; crashMultiplier?: number
}
export type GameEvent = { type: string; roundId: string; sequence: number; eventId: string; timestamp: string; serverTime: string; data: Record<string, unknown> }
export type Replay = { roundId: string; events: GameEvent[]; oldestAvailableSequence: number; latestSequence: number; snapshotRequired: boolean; serverTime: string }
export type HistoryItem = { roundId: string; username?: string; displayName?: string; boosterTier?: number; theme: Theme; betAmount: number; boosterMultiplier: number; cashoutMultiplier?: number; crashMultiplier: number; winAmount: number; score: number; result: 'WIN' | 'LOSS'; completedAt: string; reward?: { id?: string; type: string; rarity: string; createdAt?: string } }
export type HistoryPage = { items: HistoryItem[]; page: number; size: number; total: number; serverTime?: string }
export type PlayerCharacterCode = 'CAUTIOUS' | 'COLD_BLOODED' | 'CLOSE_CALL' | 'BOOSTER_HUNTER' | 'GREEDY' | 'ADVENTURER'
export type PlayerCharacter = { code: PlayerCharacterCode; title: string; description: string }
export type ResultReward = {
  type: string; puzzleId?: string; puzzleName?: string; fragmentGranted?: number; fragments?: number
  totalFragments?: number; puzzleCompleted?: boolean; unlockedClothing?: { id: string; name: string }; grantedAt?: string
  /** Compatibility fields used only by legacy mock fixtures. */
  rarity?: string; fragmentId?: string; currentFragments?: number; completed?: boolean; clothingId?: string
}
export type Result = { roundId: string; result: 'WIN' | 'LOSS'; betAmount: number; cashoutMultiplier?: number; crashMultiplier: number; winAmount: number; potentialWinAmount?: number; score: number; balanceAfter?: number; playerCharacter?: PlayerCharacter; reward?: ResultReward }
export type StartInput = { theme: Theme; betAmount: number; boosterMultiplier: number }
export type Tournament = { id: string; name: string; description: string; status: string; startsAt: string; endsAt: string; secondsRemaining: number; serverTime: string; revision: number }
export type LeaderboardEntry = { position: number; userId: string; username: string; score: number }
export type Leaderboard = { tournament: Tournament; top3: LeaderboardEntry[]; participants: LeaderboardEntry[]; currentPlayer?: LeaderboardEntry; totalParticipants: number; page: number; size: number; updatedAt: string }
export type TournamentUpdate = { type: 'LEADERBOARD_UPDATE'; tournamentId: string; revision: number; topPlayers: Omit<LeaderboardEntry, 'username'>[]; changedPlayer?: Omit<LeaderboardEntry, 'username'>; totalParticipants: number; updatedAt: string }
/** Global rating is all registered users; it is not the participant-only Tournament leaderboard. */
export type GlobalRatingEntry = { rank: number; displayName: string; score: number; currentPlayer: boolean }
export type GlobalRating = { entries: GlobalRatingEntry[]; currentPlayer: GlobalRatingEntry; totalParticipants: number; page: number; size: number; revision: number }
export interface GameApi {
  startRound(input: StartInput, idempotencyKey?: string): Promise<Round>
  cashout(id: string, key: string): Promise<Round>
  getSnapshot(id: string): Promise<Round>
  getReplay(id: string, after: number): Promise<Replay>
  getFairness(id: string): Promise<Fairness>
  getResult(id: string): Promise<Result>
  getActiveRound(): Promise<Round | null>
  connect(event: (e: GameEvent) => void, connection: (s: Connection) => void): Promise<() => void>
}
export interface Api {
  mode: 'mock' | 'real'
  auth: { demos: (User & { password: string })[]; currentUser(): Promise<User | null>; login(login: string, password: string): Promise<User>; logout(): Promise<void>; onRequired?(listener: () => void): () => void }
  economy: { getBalance(id?: string): Promise<Wallet> }
  upsell: { getOffer(roundId: string): Promise<Scenario8Offer | null>; purchase(offerId: string, key: string): Promise<Scenario8Purchase> }
  catalog: { get(): Promise<Catalog> }
  history: { getGlobalHistory(page?: number, size?: number): Promise<HistoryPage>; getPersonalHistory(page?: number, size?: number): Promise<HistoryPage> }
  game: GameApi
  tournament: {
    getActive(): Promise<{ active: boolean; tournament?: Tournament }>
    getLeaderboard(id: string): Promise<Leaderboard>
    join(id: string): Promise<void>
    connect(id: string, update: (value: TournamentUpdate) => void, connection: (state: Connection) => void): Promise<() => void>
  }
  rating: { get(page?: number, size?: number): Promise<GlobalRating> }
  profile: { get(): Promise<unknown>; wardrobe(): Promise<unknown>; equip(headId: string | null, neckId: string | null): Promise<unknown> }
  dev?: { setPreset(p: Preset): void; disconnect(): void; setBalance(id: string, balance: number): void }
}

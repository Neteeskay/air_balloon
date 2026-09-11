export type Theme = 'GREEN' | 'RED'
export type Preset = 'WIN' | 'LOSE' | 'BOOSTER' | 'RECONNECT'
export type Connection = 'connecting' | 'connected' | 'disconnected' | 'recovering'
export type User = { id: string; name: string; login: string; initials: string; color: string }
export type Wallet = { bonusBalance: number; gameScore: number }
export type Catalog = {
  stakes: number[]; stakeRules: { minimum: number; maximum: number; decimalPlaces: number }
  boosters: number[]; levels: Record<Theme, number>; pointsPerLevel?: number; cashoutPoints?: number
}
export type Fairness = { roundId: string; commitment: string; status: 'COMMITTED' | 'REVEALED'; serverSeed?: string; crashMultiplier?: number; boosterLevel?: number; verified?: boolean; canonicalInput?: string; algorithm?: string; format?: string; example?: boolean }
export type Round = {
  id: string; roundId: string; theme: Theme; betAmount: number; boosterMultiplier: number
  boosterActivated: boolean; boosterLevel?: number; currentMultiplier: number; currentLevel: number
  totalLevels: number; levelThresholds: number[]; cashoutAvailable: boolean; cashoutPerformed: boolean
  cashoutMultiplier?: number; winAmount: number; roundScore: number
  status: 'RUNNING' | 'CASHED_OUT' | 'CRASHED' | 'FINISHED'; outcome?: 'CASHED_OUT' | 'LOSS'
  startedAt: string; timestamp: string; serverTime: string; finishedAt?: string; sequence: number
  fairnessCommitment: string; fairnessReveal?: Fairness; crashMultiplier?: number
}
export type GameEvent = { type: string; roundId: string; sequence: number; eventId: string; timestamp: string; serverTime: string; data: Record<string, unknown> }
export type Replay = { roundId: string; events: GameEvent[]; oldestAvailableSequence: number; latestSequence: number; snapshotRequired: boolean; serverTime: string }
export type HistoryItem = { roundId: string; username?: string; theme: Theme; betAmount: number; boosterMultiplier: number; cashoutMultiplier?: number; crashMultiplier: number; winAmount: number; score: number; result: 'WIN' | 'LOSS'; completedAt: string; reward?: { id?: string; type: string; rarity: string; createdAt?: string } }
export type HistoryPage = { items: HistoryItem[]; page: number; size: number; total: number; serverTime?: string }
export type Result = { roundId: string; result: 'WIN' | 'LOSS'; betAmount: number; cashoutMultiplier?: number; crashMultiplier: number; winAmount: number; score: number; reward?: { type: string; rarity: string } }
export type StartInput = { theme: Theme; betAmount: number; boosterMultiplier: number }
export type Tournament = { id: string; name: string; description: string; status: string; startsAt: string; endsAt: string; secondsRemaining: number; serverTime: string; revision: number }
export type LeaderboardEntry = { position: number; userId: string; username: string; score: number }
export type Leaderboard = { tournament: Tournament; top3: LeaderboardEntry[]; participants: LeaderboardEntry[]; currentPlayer?: LeaderboardEntry; totalParticipants: number; page: number; size: number; updatedAt: string }
export type TournamentUpdate = { type: 'LEADERBOARD_UPDATE'; tournamentId: string; revision: number; topPlayers: Omit<LeaderboardEntry, 'username'>[]; changedPlayer?: Omit<LeaderboardEntry, 'username'>; totalParticipants: number; updatedAt: string }
export interface GameApi {
  startRound(input: StartInput): Promise<Round>
  cashout(id: string, key: string): Promise<Round>
  getSnapshot(id: string): Promise<Round>
  getReplay(id: string, after: number): Promise<Replay>
  getFairness(id: string): Promise<Fairness>
  getResult(id: string): Promise<Result>
  connect(event: (e: GameEvent) => void, connection: (s: Connection) => void): Promise<() => void>
}
export interface Api {
  mode: 'mock' | 'real'
  auth: { demos: (User & { password: string })[]; currentUser(): Promise<User | null>; login(login: string, password: string): Promise<User>; logout(): Promise<void>; onRequired?(listener: () => void): () => void }
  economy: { getBalance(id?: string): Promise<Wallet> }
  catalog: { get(): Promise<Catalog> }
  history: { getHistory(page?: number): Promise<HistoryPage> }
  game: GameApi
  tournament: {
    getActive(): Promise<{ active: boolean; tournament?: Tournament }>
    getLeaderboard(id: string): Promise<Leaderboard>
    join(id: string): Promise<void>
    connect(id: string, update: (value: TournamentUpdate) => void, connection: (state: Connection) => void): Promise<() => void>
  }
  dev?: { setPreset(p: Preset): void; disconnect(): void; setBalance(id: string, balance: number): void }
}

import type { Round, Theme } from '../api/types'

export class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

export function round(theme: Theme = 'GREEN', patch: Partial<Round> = {}): Round {
  const levels = theme === 'GREEN' ? [1.2, 1.5, 2, 3, 4, 6, 8, 10, 12] : [1.2, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20]
  return { id: 'round-1', roundId: 'round-1', theme, betAmount: 100, boosterMultiplier: 1, boosterActivated: false,
    currentMultiplier: 1, currentLevel: 0, totalLevels: levels.length, levelThresholds: levels,
    cashoutAvailable: false, cashoutPerformed: false, winAmount: 0, roundScore: 0, status: 'RUNNING',
    startedAt: '2026-09-11T00:00:00Z', timestamp: '2026-09-11T00:00:00Z', serverTime: '2026-09-11T00:00:00Z',
    sequence: 1, fairnessCommitment: 'demo-commitment', ...patch }
}

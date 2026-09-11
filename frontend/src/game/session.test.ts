import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_KEY } from '../api/demoUsers'
import { MockBackend } from '../api/mock'
import { MemoryStorage } from '../test/helpers'
import type { GameApi, GameEvent, Round } from '../api/types'
import { GameSession } from './session'

describe('GameSession reconnect', () => {
  afterEach(() => vi.useRealTimers())
  it('restores authoritative snapshot after disconnect and resumes events', async () => {
    vi.useFakeTimers(); let now = Date.parse('2026-09-11T00:00:00Z')
    const storage = new MemoryStorage(); storage.setItem(SESSION_KEY, 'anna')
    const backend = new MockBackend(storage, () => now, false); const session = new GameSession(backend.api.game)
    await session.start({ theme: 'GREEN', betAmount: 100, boosterMultiplier: 1 })
    now += 2500; backend.tick(); const before = session.getSnapshot().round!.sequence
    await session.cashout(); const fixedMultiplier = session.getSnapshot().round!.cashoutMultiplier
    backend.api.dev!.disconnect(); expect(session.getSnapshot().connection).toBe('disconnected')
    now += 3000; await vi.advanceTimersByTimeAsync(2500); await Promise.resolve(); await Promise.resolve()
    expect(session.getSnapshot().connection).toBe('connected')
    expect(session.getSnapshot().recovered).toBe(1)
    expect(session.getSnapshot().round!.sequence).toBeGreaterThan(before)
    expect(session.getSnapshot().round!.cashoutPerformed).toBe(true)
    expect(session.getSnapshot().round!.cashoutMultiplier).toBe(fixedMultiplier)
    session.dispose(); backend.dispose()
  })
})

describe('GameSession event ordering', () => {
  it('ignores duplicate and stale events, and fills a sequence gap from replay', async () => {
    const round: Round = {
      id: 'round-1', roundId: 'round-1', theme: 'GREEN', betAmount: 4, boosterMultiplier: 1,
      boosterActivated: false, currentMultiplier: 1.2, currentLevel: 1, totalLevels: 9,
      levelThresholds: [1.2, 1.5, 2, 3, 4, 6, 8, 10, 12], cashoutAvailable: true,
      cashoutPerformed: false, winAmount: 0, roundScore: 100, status: 'RUNNING',
      startedAt: '2026-09-11T00:00:00Z', timestamp: '2026-09-11T00:00:01Z',
      serverTime: '2026-09-11T00:00:01Z', sequence: 10, fairnessCommitment: 'commitment'
    }
    const event = (sequence: number, type: string, data: Record<string, unknown>): GameEvent => ({
      type, roundId: round.id, sequence, eventId: `${round.id}:${sequence}`,
      timestamp: `2026-09-11T00:00:${sequence}Z`, serverTime: `2026-09-11T00:00:${sequence}Z`, data
    })
    const replayEvents = [
      event(11, 'LEVEL_REACHED', { level: 2, multiplier: 1.5, pointsToAward: 100 }),
      event(12, 'MULTIPLIER_UPDATE', { level: 2, multiplier: 1.6 })
    ]
    let receive!: (value: GameEvent) => void
    const game = {
      connect: vi.fn(async (onEvent, onConnection) => {
        receive = onEvent; onConnection('connected'); return () => {}
      }),
      getSnapshot: vi.fn(async () => structuredClone(round)),
      getReplay: vi.fn(async () => ({
        roundId: round.id, events: replayEvents, oldestAvailableSequence: 1,
        latestSequence: 12, snapshotRequired: false, serverTime: '2026-09-11T00:00:12Z'
      })),
      startRound: vi.fn(), cashout: vi.fn(), getFairness: vi.fn(), getResult: vi.fn()
    } as unknown as GameApi
    const session = new GameSession(game)

    await session.recover(round.id)
    receive(event(10, 'LEVEL_REACHED', { level: 99, multiplier: 99, pointsToAward: 9999 }))
    expect(session.getSnapshot().round?.roundScore).toBe(100)

    receive(event(12, 'MULTIPLIER_UPDATE', { level: 2, multiplier: 1.6 }))
    await vi.waitFor(() => expect(session.getSnapshot().recovered).toBe(2))
    expect(game.getReplay).toHaveBeenCalledWith(round.id, 10)
    expect(session.getSnapshot().round).toMatchObject({ sequence: 12, currentLevel: 2, currentMultiplier: 1.6, roundScore: 200 })
    expect(session.getSnapshot().sound).toBeNull()

    receive(event(11, 'LEVEL_REACHED', { level: 50, multiplier: 50, pointsToAward: 5000 }))
    expect(session.getSnapshot().round).toMatchObject({ sequence: 12, roundScore: 200 })
    session.dispose()
  })

  it('emits one cue for each accepted live level or booster event', async () => {
    const current: Round = {
      id: 'round-live', roundId: 'round-live', theme: 'GREEN', betAmount: 100, boosterMultiplier: 2,
      boosterActivated: false, currentMultiplier: 1, currentLevel: 0, totalLevels: 9,
      levelThresholds: [1.2, 1.5, 2, 3, 4, 6, 8, 10, 12], cashoutAvailable: false,
      cashoutPerformed: false, winAmount: 0, roundScore: 0, status: 'RUNNING', sequence: 10,
      startedAt: '2026-09-11T00:00:00Z', timestamp: '2026-09-11T00:00:01Z',
      serverTime: '2026-09-11T00:00:01Z', fairnessCommitment: 'commitment'
    }
    const event = (sequence: number, type: string, data: Record<string, unknown>): GameEvent => ({
      type, roundId: current.id, sequence, eventId: `${current.id}:${sequence}`,
      timestamp: '2026-09-11T00:00:02Z', serverTime: '2026-09-11T00:00:02Z', data
    })
    let receive!: (value: GameEvent) => void
    const game = {
      connect: vi.fn(async (onEvent, onConnection) => { receive = onEvent; onConnection('connected'); return () => {} }),
      getSnapshot: vi.fn(async () => structuredClone(current)), getReplay: vi.fn(),
      startRound: vi.fn(), cashout: vi.fn(), getFairness: vi.fn(), getResult: vi.fn()
    } as unknown as GameApi
    const session = new GameSession(game)
    await session.recover(current.id)
    const cues: string[] = []
    let previous = session.getSnapshot().sound
    session.subscribe(() => {
      const cue = session.getSnapshot().sound
      if (cue && cue !== previous) cues.push(`${cue.type}:${cue.sequence}`)
      previous = cue
    })

    const level = event(11, 'LEVEL_REACHED', { level: 1, multiplier: 1.2, pointsToAward: 100 })
    receive(level); receive(level)
    receive(event(12, 'BOOSTER_ACTIVATED', { booster: 2, level: 1, afterMultiplier: 2.4, pointsToAward: 200 }))

    expect(cues).toEqual(['LEVEL_REACHED:11', 'BOOSTER_ACTIVATED:12'])
    session.dispose()
  })
})

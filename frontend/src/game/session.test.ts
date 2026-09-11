import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_KEY } from '../api/demoUsers'
import { MockBackend } from '../api/mock'
import { MemoryStorage } from '../test/helpers'
import { GameSession } from './session'

describe('GameSession reconnect', () => {
  afterEach(() => vi.useRealTimers())
  it('restores authoritative snapshot after disconnect and resumes events', async () => {
    vi.useFakeTimers(); let now = Date.parse('2026-09-11T00:00:00Z')
    const storage = new MemoryStorage(); storage.setItem(SESSION_KEY, 'anna')
    const backend = new MockBackend(storage, () => now, false); const session = new GameSession(backend.api.game)
    await session.start({ theme: 'GREEN', betAmount: 100, boosterMultiplier: 1 })
    now += 2500; backend.tick(); const before = session.getSnapshot().round!.sequence
    backend.api.dev!.disconnect(); expect(session.getSnapshot().connection).toBe('disconnected')
    now += 3000; await vi.advanceTimersByTimeAsync(2500); await Promise.resolve(); await Promise.resolve()
    expect(session.getSnapshot().connection).toBe('connected')
    expect(session.getSnapshot().recovered).toBeGreaterThan(0)
    expect(session.getSnapshot().round!.sequence).toBeGreaterThan(before)
    session.dispose(); backend.dispose()
  })
})

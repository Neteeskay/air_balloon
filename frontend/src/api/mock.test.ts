import { beforeEach, describe, expect, it } from 'vitest'
import { SESSION_KEY } from './demoUsers'
import { MockBackend } from './mock'
import { MemoryStorage } from '../test/helpers'

describe('deterministic mock adapters', () => {
  let now: number; let storage: MemoryStorage; let backend: MockBackend
  beforeEach(() => { now = Date.parse('2026-09-11T00:00:00Z'); storage = new MemoryStorage(); storage.setItem(SESSION_KEY, 'anna'); backend = new MockBackend(storage, () => now, false) })
  it('deducts stake and credits a server-like fixed cashout payout', async () => {
    const r = await backend.api.game.startRound({ theme: 'GREEN', betAmount: 100, boosterMultiplier: 1 })
    expect((await backend.api.economy.getBalance('anna')).bonusBalance).toBe(4900)
    now += 2000; backend.tick(); const ready = await backend.api.game.getSnapshot(r.id)
    expect(ready.cashoutAvailable).toBe(true)
    const paid = await backend.api.game.cashout(r.id, 'key')
    expect((await backend.api.economy.getBalance('anna')).bonusBalance).toBe(4900 + paid.winAmount)
  })
  it('activates a booster reached before cashout', async () => {
    const r = await backend.api.game.startRound({ theme: 'GREEN', betAmount: 100, boosterMultiplier: 2 })
    expect(r.boosterLevel).toBeUndefined()
    now += 8500; backend.tick(); const snapshot = await backend.api.game.getSnapshot(r.id)
    expect(snapshot.boosterActivated).toBe(true); expect(snapshot.boosterLevel).toBe(3); expect(snapshot.roundScore).toBeGreaterThan(200)
  })
  it('does not activate a future booster after cashout', async () => {
    const r = await backend.api.game.startRound({ theme: 'GREEN', betAmount: 100, boosterMultiplier: 4 })
    now += 2000; backend.tick(); await backend.api.game.cashout(r.id, 'key')
    now += 16500; backend.tick(); const snapshot = await backend.api.game.getSnapshot(r.id)
    expect(snapshot.status).toBe('FINISHED'); expect(snapshot.boosterActivated).toBe(false); expect(snapshot.outcome).toBe('CASHED_OUT')
  })
  it('keeps cashout as WIN after the later crash', async () => {
    const r = await backend.api.game.startRound({ theme: 'GREEN', betAmount: 100, boosterMultiplier: 1 })
    now += 2000; backend.tick(); await backend.api.game.cashout(r.id, 'key'); now += 16500; backend.tick()
    expect((await backend.api.game.getResult(r.id)).result).toBe('WIN')
    expect((await backend.api.history.getHistory()).items[0].result).toBe('WIN')
  })
  it('returns LOSE when crash happens without cashout', async () => {
    backend.api.dev!.setPreset('LOSE')
    const r = await backend.api.game.startRound({ theme: 'RED', betAmount: 100, boosterMultiplier: 1 })
    now += 8100; backend.tick(); expect((await backend.api.game.getResult(r.id)).result).toBe('LOSS')
    expect((await backend.api.economy.getBalance('anna')).bonusBalance).toBe(4900)
  })
})

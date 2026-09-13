import { beforeEach, describe, expect, it } from 'vitest'
import { round } from '../../../test/helpers'
import { clearPersistedRound, persistRound, readPersistedRound, ROUND_PERSISTENCE_TTL_MS } from './useRoundPersistence'

describe('round persistence', () => {
  beforeEach(() => localStorage.clear())

  it('keeps an active snapshot and expires it after the recovery window', () => {
    const savedAt = Date.parse('2026-09-13T10:00:00Z')
    const value = round('RED', { currentMultiplier: 2.35, currentLevel: 4, boosterMultiplier: 2, boosterActivated: true })
    persistRound('user:demo', value, savedAt)

    expect(readPersistedRound('user:demo', savedAt + 5_000)).toMatchObject({
      id: value.id,
      theme: 'RED',
      currentMultiplier: 2.35,
      currentLevel: 4,
      boosterActivated: true,
    })
    expect(readPersistedRound('user:demo', savedAt + ROUND_PERSISTENCE_TTL_MS + 1)).toBeNull()
  })

  it('does not restore terminal snapshots and can clear a live one explicitly', () => {
    const savedAt = Date.parse('2026-09-13T10:00:00Z')
    persistRound('user:demo', round('GREEN', { status: 'FINISHED' }), savedAt)
    expect(readPersistedRound('user:demo', savedAt)).toBeNull()

    persistRound('user:demo', round(), savedAt)
    clearPersistedRound('user:demo')
    expect(readPersistedRound('user:demo', savedAt)).toBeNull()
  })
})


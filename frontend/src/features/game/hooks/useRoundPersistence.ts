import { useCallback, useEffect, useRef } from 'react'
import type { Round } from '../../../api/types'

/** A round snapshot is useful only for a short reconnect/reload window. */
export const ROUND_PERSISTENCE_TTL_MS = 60 * 60 * 1000
const STORAGE_PREFIX = 'air-balloon:round-snapshot:v1:'

type StoredRound = {
  savedAt: number
  round: Round
}

const storageKey = (scope: string) => `${STORAGE_PREFIX}${encodeURIComponent(scope)}`

function getStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function readPersistedRound(scope: string, now = Date.now()): Round | null {
  const storage = getStorage()
  if (!storage) return null

  const key = storageKey(scope)
  const raw = storage.getItem(key)
  if (!raw) return null

  try {
    const stored = JSON.parse(raw) as Partial<StoredRound>
    if (
      typeof stored.savedAt !== 'number'
      || !stored.round
      || now - stored.savedAt > ROUND_PERSISTENCE_TTL_MS
      || now < stored.savedAt - 5_000
      || stored.round.status === 'FINISHED'
    ) {
      storage.removeItem(key)
      return null
    }
    return stored.round
  } catch {
    storage.removeItem(key)
    return null
  }
}

export function persistRound(scope: string, round: Round, now = Date.now()) {
  const storage = getStorage()
  if (!storage || round.status === 'FINISHED') return
  try {
    const value: StoredRound = { savedAt: now, round }
    storage.setItem(storageKey(scope), JSON.stringify(value))
  } catch {
    // A full/private storage area must not interrupt the flight.
  }
}

export function clearPersistedRound(scope: string) {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(storageKey(scope))
  } catch {
    // Storage is an optional recovery layer.
  }
}

/**
 * Keeps the persistence concern outside the round transport. Writes happen at
 * meaningful state changes and at most once a second during a live flight, so
 * localStorage cannot become a source of animation jank.
 */
export function useRoundPersistence(scope: string | undefined, round: Round | null) {
  const latestRound = useRef<Round | null>(round)
  latestRound.current = round

  const save = useCallback(() => {
    const value = latestRound.current
    if (scope && value) persistRound(scope, value)
  }, [scope])

  const clear = useCallback(() => {
    if (scope) clearPersistedRound(scope)
  }, [scope])

  useEffect(() => {
    if (!scope) return undefined

    if (round?.status === 'FINISHED') {
      clearPersistedRound(scope)
      return undefined
    }

    // Save immediately after start, cashout, level/booster transitions, and
    // any authoritative snapshot. This effect intentionally excludes the
    // full object so multiplier ticks do not create a synchronous write loop.
    if (latestRound.current) persistRound(scope, latestRound.current)

    const timer = window.setInterval(() => {
      const value = latestRound.current
      if (value) persistRound(scope, value)
    }, 1_000)

    return () => window.clearInterval(timer)
  }, [round?.boosterActivated, round?.cashoutPerformed, round?.currentLevel, round?.id, round?.status, scope])

  return { clear, load: useCallback(() => scope ? readPersistedRound(scope) : null, [scope]), save }
}

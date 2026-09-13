import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../api'
import type { GameEvent, Round } from '../../../api/types'
import type { BetOption, Theme } from '../../betting/types'
import type { CrashGameFinish } from '../types'
import { useCrashSounds } from './useCrashSounds'
import { readPersistedRound, useRoundPersistence } from './useRoundPersistence'

export type CrashRoundStatus = 'flying' | 'cashed-out' | 'crashed'
type Props = { bet: number; boosterMultiplier: BetOption['multiplier']; onFinish: (result: CrashGameFinish) => void; roundId: string; soundOn: boolean; theme: Theme; persistenceScope?: string }

function hasSameVisualState(left: Round, right: Round) {
  return left.sequence === right.sequence
    && left.status === right.status
    && left.currentMultiplier === right.currentMultiplier
    && left.currentLevel === right.currentLevel
    && left.roundScore === right.roundScore
    && left.cashoutAvailable === right.cashoutAvailable
    && left.cashoutPerformed === right.cashoutPerformed
    && left.cashoutPreviewAmount === right.cashoutPreviewAmount
    && left.cashoutMultiplier === right.cashoutMultiplier
    && left.winAmount === right.winAmount
    && left.boosterActivated === right.boosterActivated
    && left.boosterLevel === right.boosterLevel
    && left.crashMultiplier === right.crashMultiplier
}

export function useCrashRound({ onFinish, persistenceScope, roundId, soundOn }: Props) {
  const restoredRound = useMemo(() => {
    const restored = persistenceScope ? readPersistedRound(persistenceScope) : null
    return restored?.id === roundId ? restored : null
  }, [persistenceScope, roundId])
  const [server, setServer] = useState<Round | null>(restoredRound)
  const [status, setStatus] = useState<CrashRoundStatus>(() => (
    restoredRound?.status === 'CASHED_OUT'
      ? 'cashed-out'
      : restoredRound?.status === 'CRASHED' || restoredRound?.status === 'FINISHED'
        ? 'crashed'
        : 'flying'
  ))
  const [connection, setConnection] = useState<'connected'|'recovering'|'disconnected'>('recovering')
  const serverRef = useRef<Round | null>(server)
  const latestSequence = useRef(restoredRound?.sequence ?? -1)
  const finished = useRef(false)
  const cashoutPending = useRef(false)
  const pendingFrame = useRef<number | null>(null)
  const pendingServer = useRef<Round | null>(null)
  const cashoutKey = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${performance.now()}`)
  const { play, unlock } = useCrashSounds(soundOn)
  useRoundPersistence(persistenceScope, server)
  const apply = useCallback((r: Round) => {
    const current = serverRef.current
    if (r.id !== roundId || r.sequence < latestSequence.current || (current && hasSameVisualState(current, r))) return
    if (pendingFrame.current !== null) {
      window.cancelAnimationFrame(pendingFrame.current)
      pendingFrame.current = null
      pendingServer.current = null
    }
    latestSequence.current = r.sequence
    serverRef.current = r
    setServer(r)
    setStatus(r.status === 'CASHED_OUT' ? 'cashed-out' : r.status === 'CRASHED' || r.status === 'FINISHED' ? 'crashed' : 'flying')
    if ((r.status === 'CRASHED' || r.status === 'FINISHED') && !finished.current) { finished.current = true; play('crash'); window.setTimeout(() => onFinish({ payout: Number(r.winAmount ?? 0) }), 900) }
  }, [onFinish, play, roundId])
  useEffect(() => {
    let live = true
    let loading = false
    let loadAgain = false
    let stop: (() => void) | undefined
    const load = async () => {
      if (loading) { loadAgain = true; return }
      loading = true
      do {
        loadAgain = false
        try {
          const r = await api.game.getSnapshot(roundId)
          if (live) { apply(r); setConnection('connected') }
        } catch {
          if (live) setConnection('disconnected')
        }
      } while (live && loadAgain)
      loading = false
    }
    const applyProgressEvent = (event: GameEvent) => {
      const current = serverRef.current
      if (!current || event.sequence <= latestSequence.current) return
      const multiplier = Number(event.type === 'BOOSTER_ACTIVATED' ? event.data.afterMultiplier : event.data.multiplier)
      const level = Number(event.data.level)
      if (!Number.isFinite(multiplier) || !Number.isFinite(level)) { void load(); return }
      const preview = Number(event.data.cashoutPreviewAmount)
      const next: Round = {
        ...current,
        currentLevel: level,
        currentMultiplier: multiplier,
        ...(event.type === 'LEVEL_REACHED' ? { roundScore: current.roundScore + Number(event.data.pointsToAward ?? 0), cashoutAvailable: !current.cashoutPerformed } : {}),
        ...(event.type === 'BOOSTER_ACTIVATED' ? {
          boosterActivated: true,
          boosterLevel: level,
          roundScore: current.roundScore + Number(event.data.pointsToAward ?? 0),
          cashoutAvailable: !current.cashoutPerformed,
        } : {}),
        sequence: event.sequence,
        serverTime: event.serverTime,
        timestamp: event.timestamp,
        ...(Number.isFinite(preview) ? { cashoutPreviewAmount: preview } : {}),
      }
      latestSequence.current = event.sequence
      serverRef.current = next
      pendingServer.current = next
      // Coalesce bursts around cashout/crash into one React commit per frame.
      // There is deliberately only one pending frame and it is cancelled on
      // unmount, so a second animation loop cannot accumulate after cashout.
      if (pendingFrame.current === null) {
        pendingFrame.current = window.requestAnimationFrame(() => {
          pendingFrame.current = null
          const value = pendingServer.current
          pendingServer.current = null
          if (value) setServer(value)
        })
      }
    }
    const applyCashoutEvent = (event: GameEvent) => {
      const current = serverRef.current
      if (!current || event.sequence <= latestSequence.current) return
      const cashoutMultiplier = Number(event.data.cashoutMultiplier ?? event.data.multiplier)
      const winAmount = Number(event.data.winAmount)
      if (!Number.isFinite(cashoutMultiplier) || !Number.isFinite(winAmount)) { void load(); return }
      apply({
        ...current,
        cashoutAvailable: false,
        cashoutMultiplier,
        cashoutPerformed: true,
        cashoutPreviewAmount: undefined,
        sequence: event.sequence,
        serverTime: event.serverTime,
        status: 'CASHED_OUT',
        timestamp: event.timestamp,
        winAmount,
      })
    }
    void load()
    const timer = window.setInterval(load, 1000)
    api.game.connect(event => {
      if (!live || event.roundId !== roundId) return
      if (event.type === 'MULTIPLIER_UPDATE' || event.type === 'LEVEL_REACHED' || event.type === 'BOOSTER_ACTIVATED') applyProgressEvent(event)
      else if (event.type === 'CASHOUT_SUCCESS') applyCashoutEvent(event)
      else void load()
    }, state => live && setConnection(state === 'connected' ? 'connected' : state === 'recovering' || state === 'connecting' ? 'recovering' : 'disconnected')).then(s => { if (live) stop = s; else s() }).catch(() => live && setConnection('disconnected'))
    return () => {
      live = false
      clearInterval(timer)
      stop?.()
      if (pendingFrame.current !== null) window.cancelAnimationFrame(pendingFrame.current)
      pendingFrame.current = null
      pendingServer.current = null
    }
  }, [apply, roundId])
  const cashout = useCallback(() => { if (!server || status !== 'flying' || !server.cashoutAvailable || cashoutPending.current) return; cashoutPending.current = true; void api.game.cashout(roundId, cashoutKey.current).then(apply).then(() => play('cashout')).catch(() => {}).finally(() => { cashoutPending.current = false }) }, [apply, play, roundId, server, status])
  const levels = (server?.levelThresholds ?? []).map(Number)
  const raw = Number(server?.currentMultiplier ?? 1)
  return { canCashout: status === 'flying' && Boolean(server?.cashoutAvailable), cashout, cashoutCoefficient: server?.cashoutMultiplier ? Number(server.cashoutMultiplier) : null, cashoutPayout: Number(server?.winAmount ?? 0), coefficient: raw, levels, boosterActivated: Boolean(server?.boosterActivated), boosterLevel: Number(server?.boosterLevel ?? 0), unlockSounds: unlock, mock: { boosterLevel: Number(server?.boosterLevel ?? 0), pointsPerLine: 0 }, points: Number(server?.roundScore ?? 0), potentialPayout: Number(server?.cashoutPreviewAmount ?? 0), rawCoefficient: raw, reachedLevels: Number(server?.currentLevel ?? 0), status, connection }
}

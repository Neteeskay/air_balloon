import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../api'
import type { GameEvent, Round } from '../../../api/types'
import type { BetOption, Theme } from '../../betting/types'
import type { CrashGameFinish } from '../types'
import { useCrashSounds } from './useCrashSounds'
import { getVisualFlightCoefficient } from '../lib/flightProgress'

export type CrashRoundStatus = 'flying' | 'cashed-out' | 'crashed'
type Props = { bet: number; boosterMultiplier: BetOption['multiplier']; onFinish: (result: CrashGameFinish) => void; roundId: string; soundOn: boolean; theme: Theme }

export function useCrashRound({ boosterMultiplier, onFinish, roundId, soundOn }: Props) {
  const [server, setServer] = useState<Round | null>(null)
  const [status, setStatus] = useState<CrashRoundStatus>('flying')
  const [connection, setConnection] = useState<'connected'|'recovering'|'disconnected'>('recovering')
  const serverRef = useRef<Round | null>(null)
  const latestSequence = useRef(-1)
  const finished = useRef(false)
  const cashoutPending = useRef(false)
  const cashoutKey = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${performance.now()}`)
  const { play, unlock } = useCrashSounds(soundOn)
  const apply = useCallback((r: Round) => {
    if (r.id !== roundId || r.sequence < latestSequence.current) return
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
    const applyMultiplierEvent = (event: GameEvent) => {
      const current = serverRef.current
      if (!current || event.sequence <= latestSequence.current) return
      const multiplier = Number(event.data.multiplier)
      const flightMultiplier = Number(event.data.flightMultiplier)
      const level = Number(event.data.level)
      if (!Number.isFinite(multiplier) || !Number.isFinite(level)) { void load(); return }
      const preview = Number(event.data.cashoutPreviewAmount)
      const next: Round = {
        ...current,
        currentLevel: level,
        currentMultiplier: multiplier,
        ...(Number.isFinite(flightMultiplier) ? { flightMultiplier } : {}),
        ...(Number.isFinite(flightMultiplier) ? { effectiveMultiplier: multiplier } : {}),
        sequence: event.sequence,
        serverTime: event.serverTime,
        timestamp: event.timestamp,
        ...(Number.isFinite(preview) ? { cashoutPreviewAmount: preview } : {}),
      }
      latestSequence.current = event.sequence
      serverRef.current = next
      setServer(next)
    }
    void load()
    const timer = window.setInterval(load, 1000)
    api.game.connect(event => {
      if (!live || event.roundId !== roundId) return
      if (event.type === 'MULTIPLIER_UPDATE') applyMultiplierEvent(event)
      else void load()
    }, state => live && setConnection(state === 'connected' ? 'connected' : state === 'recovering' || state === 'connecting' ? 'recovering' : 'disconnected')).then(s => { stop = s }).catch(() => live && setConnection('disconnected'))
    return () => { live = false; clearInterval(timer); stop?.() }
  }, [apply, roundId])
  const cashout = useCallback(() => { if (!server || status !== 'flying' || !server.cashoutAvailable || cashoutPending.current) return; cashoutPending.current = true; void api.game.cashout(roundId, cashoutKey.current).then(apply).then(() => play('cashout')).catch(() => {}).finally(() => { cashoutPending.current = false }) }, [apply, play, roundId, server, status])
  const levels = (server?.levelThresholds ?? []).map(Number)
  const raw = Number(server?.currentMultiplier ?? 1)
  const flight = Number.isFinite(Number(server?.flightMultiplier))
    ? Number(server?.flightMultiplier)
    : getVisualFlightCoefficient(raw, Boolean(server?.boosterActivated), boosterMultiplier)
  return { canCashout: status === 'flying' && Boolean(server?.cashoutAvailable), cashout, cashoutCoefficient: server?.cashoutMultiplier ? Number(server.cashoutMultiplier) : null, cashoutPayout: Number(server?.winAmount ?? 0), coefficient: raw, levels, boosterActivated: Boolean(server?.boosterActivated), boosterLevel: Number(server?.boosterLevel ?? 0), unlockSounds: unlock, mock: { boosterLevel: Number(server?.boosterLevel ?? 0), pointsPerLine: 0 }, points: Number(server?.roundScore ?? 0), potentialPayout: Number(server?.cashoutPreviewAmount ?? 0), rawCoefficient: flight, reachedLevels: Number(server?.currentLevel ?? 0), status, connection }
}

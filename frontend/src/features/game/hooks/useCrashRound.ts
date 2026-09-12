import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../../../api'
import type { Round } from '../../../api/types'
import type { BetOption, Theme } from '../../betting/types'
import type { CrashGameFinish } from '../types'
import { useCrashSounds } from './useCrashSounds'

export type CrashRoundStatus = 'flying' | 'cashed-out' | 'crashed'
type Props = { bet: number; boosterMultiplier: BetOption['multiplier']; onFinish: (result: CrashGameFinish) => void; roundId: string; soundOn: boolean; theme: Theme }

export function useCrashRound({ bet, boosterMultiplier, onFinish, roundId, soundOn }: Props) {
  const [server, setServer] = useState<Round | null>(null)
  const [status, setStatus] = useState<CrashRoundStatus>('flying')
  const [connection, setConnection] = useState<'connected'|'recovering'|'disconnected'>('recovering')
  const finished = useRef(false)
  const cashoutPending = useRef(false)
  const cashoutKey = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${performance.now()}`)
  const { play } = useCrashSounds(soundOn)
  const apply = useCallback((r: Round) => {
    setServer(r)
    setStatus(r.status === 'CASHED_OUT' ? 'cashed-out' : r.status === 'CRASHED' || r.status === 'FINISHED' ? 'crashed' : 'flying')
    if ((r.status === 'CRASHED' || r.status === 'FINISHED') && !finished.current) { finished.current = true; play('crash'); window.setTimeout(() => onFinish({ payout: Number(r.winAmount ?? 0) }), 900) }
  }, [onFinish, play])
  useEffect(() => {
    let live = true; let stop: (() => void) | undefined
    const load = async () => { try { const r = await api.game.getSnapshot(roundId); if (live) { apply(r); setConnection('connected') } } catch { if (live) setConnection('disconnected') } }
    void load()
    const timer = window.setInterval(load, 1000)
    api.game.connect(event => { if (!live || event.roundId !== roundId) return; void api.game.getSnapshot(roundId).then(r => live && apply(r)).catch(() => {}) }, state => live && setConnection(state === 'connected' ? 'connected' : state === 'recovering' ? 'recovering' : 'disconnected')).then(s => { stop = s }).catch(() => live && setConnection('disconnected'))
    return () => { live = false; clearInterval(timer); stop?.() }
  }, [apply, roundId])
  const cashout = useCallback(() => { if (!server || status !== 'flying' || !server.cashoutAvailable || cashoutPending.current) return; cashoutPending.current = true; void api.game.cashout(roundId, cashoutKey.current).then(apply).then(() => play('cashout')).catch(() => {}).finally(() => { cashoutPending.current = false }) }, [apply, play, roundId, server, status])
  const levels = (server?.levelThresholds ?? []).map(Number)
  const raw = Number(server?.currentMultiplier ?? 1)
  return { canCashout: status === 'flying' && Boolean(server?.cashoutAvailable), cashout, cashoutCoefficient: server?.cashoutMultiplier ? Number(server.cashoutMultiplier) : null, cashoutPayout: Number(server?.winAmount ?? 0), coefficient: raw, levels, mock: { boosterLevel: Number(server?.boosterLevel ?? 0), pointsPerLine: 0 }, points: Number(server?.roundScore ?? 0), potentialPayout: Number(server?.cashoutPreviewAmount ?? 0), rawCoefficient: raw, reachedLevels: Number(server?.currentLevel ?? 0), status, connection }
}

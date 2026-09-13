import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../api'
import type { User } from '../../../api/types'
import type { Result } from '../../../api/types'
import type { GameRoundSelection, GameSessionState } from '../types'
import { backgroundMusic } from '../../../audio/backgroundMusic'

const initialSession = (): GameSessionState => ({ balance: 0, round: null, soundOn: !backgroundMusic.isMuted(), theme: 'green' })

export function useGameSession() {
  const [session, setSession] = useState<GameSessionState>(initialSession)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [profile, setProfile] = useState<unknown>(null)
  const [betOptions, setBetOptions] = useState<Array<{ id: number; cost: number; multiplier: 1|2|3|4 }>>([])
  const lastSelection = useState<{ theme: 'green' | 'red'; bet: number; boosterMultiplier: 1|2|3|4 } | null>(null)
  const lastSelectionValue = lastSelection[0]
  const setLastSelection = lastSelection[1]
  const refresh = useCallback(async () => { if (!user) return; try { const wallet = await api.economy.getBalance(); setSession(s => ({ ...s, balance: wallet.bonusBalance })) } catch { /* preserve last canonical value */ } }, [user])
  useEffect(() => {
    let live = true
    api.auth.currentUser().then(async current => {
      if (!live) return
      setUser(current)
      if (current) {
        try {
          const [wallet, active, catalog, profileValue] = await Promise.all([api.economy.getBalance(), api.game.getActiveRound(), api.catalog.get(), api.profile.get().catch(() => null)])
          if (!live) return
          setSession(s => ({ ...s, balance: wallet.bonusBalance, round: active ? { bet: Number(active.betAmount), boosterMultiplier: active.boosterMultiplier as any, roundId: active.id, showCashoutHint: false } : null, theme: active ? active.theme.toLowerCase() as any : s.theme }))
          setBetOptions(catalog.stakeOptions.map((o, i) => ({ id: i + 1, cost: Number(o.amount), multiplier: o.boosterMultiplier as 1|2|3|4 })))
          setProfile(profileValue)
        } catch (e) { if (live) setError(e instanceof Error ? e.message : 'Не удалось восстановить сессию') }
      }
    }).catch(e => live && setError(e instanceof Error ? e.message : 'Не удалось проверить сессию')).finally(() => live && setLoading(false))
    const off = api.auth.onRequired?.(() => { setUser(null); setSession(initialSession()); setError('Сессия истекла. Войдите снова.') })
    return () => { live = false; off?.() }
  }, [])
  const login = useCallback(async (loginName: string, password: string) => { const current = await api.auth.login(loginName, password); setUser(current); const [wallet, catalog, profileValue] = await Promise.all([api.economy.getBalance(), api.catalog.get(), api.profile.get().catch(() => null)]); setSession(s => ({ ...s, balance: wallet.bonusBalance })); setBetOptions(catalog.stakeOptions.map((o, i) => ({ id: i + 1, cost: Number(o.amount), multiplier: o.boosterMultiplier as 1|2|3|4 }))); setProfile(profileValue); setError(''); return current }, [])
  const logout = useCallback(async () => { await api.auth.logout(); setUser(null); setSession(initialSession()) }, [])
  const startRound = useCallback(async (round: GameRoundSelection) => {
    if (!user) return
    const selection = { theme: session.theme, ...round }
    const serverRound = await api.game.startRound({ theme: session.theme.toUpperCase() as 'GREEN' | 'RED', betAmount: round.bet, boosterMultiplier: round.boosterMultiplier }, globalThis.crypto?.randomUUID?.())
    setLastSelection(selection)
    setSession(s => ({ ...s, balance: s.balance - round.bet, round: { ...round, roundId: serverRound.id, showCashoutHint: true } }))
  }, [session.theme, setLastSelection, user])
  const repeatBet = useCallback(async () => {
    const selection = lastSelectionValue
    if (!user || !selection) throw new Error('Предыдущая ставка недоступна')
    const serverRound = await api.game.startRound({ theme: selection.theme.toUpperCase() as 'GREEN' | 'RED', betAmount: selection.bet, boosterMultiplier: selection.boosterMultiplier }, globalThis.crypto?.randomUUID?.())
    setSession(s => ({ ...s, theme: selection.theme, balance: s.balance - selection.bet, round: { bet: selection.bet, boosterMultiplier: selection.boosterMultiplier, roundId: serverRound.id, showCashoutHint: false } }))
  }, [lastSelectionValue, user])
  const finishRound = useCallback(async (): Promise<Result | null> => { const id = session.round?.roundId; let resolved: Result | null = null; if (id) { try { resolved = await api.game.getResult(id); setResult(resolved) } catch { /* result view can be retried by the next refresh */ } } setSession(s => ({ ...s, round: null })); await refresh(); return resolved }, [refresh, session.round?.roundId])
  const equip = useCallback(async (headId: string | null, neckId: string | null) => { const value = await api.profile.equip(headId, neckId); setProfile(value); return value }, [])
  const toggleSound = useCallback(() => {
    setSession(s => {
      const soundOn = !s.soundOn
      backgroundMusic.setMuted(!soundOn)
      return { ...s, soundOn }
    })
  }, [])
  return { ...session, user, loading, error, result, profile, betOptions, api, login, logout, finishRound, startRound, repeatBet, equip, clearResult: () => setResult(null), switchTheme: () => setSession(s => ({ ...s, theme: s.theme === 'green' ? 'red' : 'green' })), toggleSound, topUpBalance: () => {}, clearError: () => setError('') }
}

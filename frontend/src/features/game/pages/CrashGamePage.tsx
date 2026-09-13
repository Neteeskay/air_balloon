import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AnimatedSkyBackground } from '../../../components/sky/AnimatedSkyBackground'
import { BetSelectionHeader } from '../../betting/components/BetSelectionHeader'
import { RulesModal } from '../../betting/components/RulesModal'
import { TournamentModal } from '../../betting/components/TournamentModal'
import type { BetOption, BetSelectionModal, Theme } from '../../betting/types'
import { BalloonFlight } from '../components/BalloonFlight'
import { CoefficientDisplay } from '../components/CoefficientDisplay'
import { CrashRoundPanel } from '../components/CrashRoundPanel'
import { DynamicFlightBackground } from '../components/DynamicFlightBackground'
import { LevelProgressTrack } from '../components/LevelProgressTrack'
import { useCrashRound } from '../hooks/useCrashRound'
import { CrashResultOverlay } from '../components/CrashResultOverlay'
import { Toast } from '../../../components/ui/Toast'
import {
  getContinuousFlightProgress,
  getFlightBottomPercent,
} from '../lib/flightProgress'
import type { CrashGameFinish } from '../types'
import type { Api } from '../../../api/types'

type CrashGamePageProps = {
  balance: number
  bet: number
  boosterMultiplier: BetOption['multiplier']
  onFinish: (result: CrashGameFinish) => void
  onToggleSound: () => void
  onTopUp: () => void
  onUnlockAudio: () => void
  roundId: string
  showCashoutHint: boolean
  soundOn: boolean
  theme: Theme
  onBack?: () => void
  onProfile?: () => void
  onOpenDetailedRules?: () => void
  api?: Api
  userId?: string
}

export function CrashGamePage({
  balance,
  bet,
  boosterMultiplier,
  onFinish,
  onToggleSound,
  onTopUp,
  onUnlockAudio,
  roundId,
  showCashoutHint,
  soundOn,
  theme,
  onBack,
  onProfile,
  onOpenDetailedRules,
  api,
  userId,
}: CrashGamePageProps) {
  const [modal, setModal] = useState<BetSelectionModal>(null)
  const round = useCrashRound({ bet, boosterMultiplier, onFinish, persistenceScope: userId ? `user:${userId}` : undefined, roundId, soundOn, theme })
  const [boosterPulse, setBoosterPulse] = useState(false)
  const previousBooster = useRef(round.boosterActivated)
  const activationKey = useRef<string | null>(round.boosterActivated ? `${roundId}:${round.boosterLevel}` : null)
  const initializedAuthoritative = useRef(false)
  useEffect(() => {
    if (!initializedAuthoritative.current && round.connection === 'connected') {
      initializedAuthoritative.current = true
      previousBooster.current = round.boosterActivated
      if (round.boosterActivated) activationKey.current = `${roundId}:${round.boosterLevel}`
      return
    }
    const wasBoosterActive = previousBooster.current
    previousBooster.current = round.boosterActivated
    if (round.boosterActivated && !wasBoosterActive) {
      const key = `${roundId}:${round.boosterLevel}`
      if (activationKey.current !== key) {
        activationKey.current = key
        setBoosterPulse(true)
        const timer = window.setTimeout(() => setBoosterPulse(false), 900)
        return () => window.clearTimeout(timer)
      }
    }
    return undefined
  }, [round.boosterActivated, round.boosterLevel, round.connection, roundId])
  const visualCoefficient = round.rawCoefficient
  const authoritativeProgress = useMemo(
    () => getContinuousFlightProgress(visualCoefficient, round.levels),
    [round.levels, visualCoefficient],
  )
  const lastFlyingProgress = useRef(authoritativeProgress)
  const targetProgress = round.status === 'crashed' ? lastFlyingProgress.current : authoritativeProgress
  const progress = targetProgress
  // Level colouring is authoritative state, not an animation estimate. In
  // particular, a booster can cross several non-equidistant thresholds in a
  // single server tick, so delaying/reconstructing this number loses levels.
  const visualReachedLevels = Number.isFinite(round.reachedLevels)
    ? Math.min(round.levels.length, Math.max(0, Math.trunc(round.reachedLevels)))
    : 0
  const flightPosition = `${getFlightBottomPercent(progress)}%`
  const progressTiming = useRef(performance.now())
  const flightTransitionMs = Math.min(900, Math.max(120, performance.now() - progressTiming.current))
  useEffect(() => {
    if (round.status !== 'crashed') lastFlyingProgress.current = authoritativeProgress
  }, [authoritativeProgress, round.status])
  useEffect(() => {
    progressTiming.current = performance.now()
  }, [progress])
  return (
    <main
      className={`game-shell crash-shell theme-${theme}`}
      onKeyDownCapture={onUnlockAudio}
      onPointerDownCapture={() => { onUnlockAudio(); round.unlockSounds() }}
    >
      <div className="crash-scenery-blur" />
      <DynamicFlightBackground progress={progress} />
      <AnimatedSkyBackground />
      <BetSelectionHeader
        balance={balance}
        onOpenRules={() => setModal('rules')}
        onOpenTournament={() => setModal('tournament')}
        onToggleSound={onToggleSound}
        onTopUp={onTopUp}
        soundOn={soundOn}
        onBack={onBack}
        onProfile={onProfile}
        api={api}
      />

      <section className={`crash-stage${round.boosterActivated ? ' has-booster' : ''}${boosterPulse ? ' booster-activated' : ''}`} aria-label="Полёт воздушного шара" data-round-id={roundId}>
        {round.connection !== 'connected' && <div className="reconnect-banner" role="status">Восстанавливаем соединение…</div>}
        <CoefficientDisplay
          bet={bet}
          coefficient={round.coefficient}
          level={round.reachedLevels}
          status={round.status}
        />
        <div
          className="crash-flight-area"
          style={{ '--flight-y': flightPosition, '--flight-transition': `${flightTransitionMs}ms` } as CSSProperties}
        >
          <LevelProgressTrack
            boosterLevel={round.mock.boosterLevel}
            boosterMultiplier={boosterMultiplier}
            levels={round.levels}
            progress={progress}
            reachedLevels={visualReachedLevels}
            theme={theme}
          />
          <BalloonFlight
            pointsPerLine={round.mock.pointsPerLine}
            progress={progress}
            reachedLevels={visualReachedLevels}
            status={round.status}
            theme={theme}
          />
        </div>
        <CrashRoundPanel
          canCashout={round.canCashout}
          cashoutPayout={round.cashoutPayout}
          onCashout={round.cashout}
          points={round.points}
          potentialPayout={round.potentialPayout}
          showCashoutHint={showCashoutHint}
          status={round.status}
        />
        <CrashResultOverlay cashoutPayout={round.cashoutPayout} status={round.status} />
      </section>

      {boosterPulse && <div className="booster-activation-pulse" role="status" aria-live="polite">Бустер активирован!</div>}

      <Toast message={round.cashoutPayout > 0 && round.status !== 'crashed' ? 'Могли бы забрать больше' : ''} />
      {modal === 'rules' && (
        <RulesModal
          onClose={() => setModal(null)}
          onOpenDetails={onOpenDetailedRules}
        />
      )}
      {modal === 'tournament' && <TournamentModal api={api} onClose={() => setModal(null)} />}
    </main>
  )
}

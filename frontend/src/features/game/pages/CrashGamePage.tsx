import { useMemo, useState, type CSSProperties } from 'react'
import { AnimatedSkyBackground } from '../../../components/sky/AnimatedSkyBackground'
import { Toast } from '../../../components/ui/Toast'
import { BetSelectionHeader } from '../../betting/components/BetSelectionHeader'
import { RulesModal } from '../../betting/components/RulesModal'
import { TournamentModal } from '../../betting/components/TournamentModal'
import type { BetOption, BetSelectionModal, Theme } from '../../betting/types'
import { BalloonFlight } from '../components/BalloonFlight'
import { CoefficientDisplay } from '../components/CoefficientDisplay'
import { CrashResultOverlay } from '../components/CrashResultOverlay'
import { CrashRoundPanel } from '../components/CrashRoundPanel'
import { DynamicFlightBackground } from '../components/DynamicFlightBackground'
import { LevelProgressTrack } from '../components/LevelProgressTrack'
import { useCrashRound } from '../hooks/useCrashRound'
import { getFlightBottomPercent } from '../lib/flightProgress'
import type { CrashGameFinish } from '../types'

type CrashGamePageProps = {
  balance: number
  bet: number
  boosterMultiplier: BetOption['multiplier']
  crashAt?: number
  initialCashoutMultiplier?: number | null
  onCashout?: (multiplier: number) => void
  onFinish: (result: CrashGameFinish) => void
  onBack: () => void
  onProfile: () => void
  onToggleSound: () => void
  onTopUp: () => void
  onUnlockAudio: () => void
  roundId: string | number
  showCashoutHint: boolean
  soundOn: boolean
  startedAt?: number
  theme: Theme
}

export function CrashGamePage({
  balance,
  bet,
  boosterMultiplier,
  crashAt,
  initialCashoutMultiplier,
  onCashout,
  onFinish,
  onBack,
  onProfile,
  onToggleSound,
  onTopUp,
  onUnlockAudio,
  roundId,
  showCashoutHint,
  soundOn,
  startedAt,
  theme,
}: CrashGamePageProps) {
  const [modal, setModal] = useState<BetSelectionModal>(null)
  const round = useCrashRound({
    bet,
    boosterMultiplier,
    crashAt,
    initialCashoutMultiplier,
    onCashout,
    onFinish,
    roundId,
    soundOn,
    startedAt,
    theme,
  })
  const progress = useMemo(() => {
    const lastThreshold = round.levels[round.levels.length - 1]
    return Math.min(1, Math.max(0, (round.rawCoefficient - 1) / (lastThreshold - 1)))
  }, [round.levels, round.rawCoefficient])
  const flightPosition = `${getFlightBottomPercent(progress)}%`

  return (
    <main
      className={`game-shell crash-shell theme-${theme}`}
      onKeyDownCapture={onUnlockAudio}
      onPointerDownCapture={onUnlockAudio}
    >
      <div className="crash-scenery-blur" />
      <DynamicFlightBackground progress={progress} />
      <AnimatedSkyBackground />
      <BetSelectionHeader
        balance={balance}
        onBack={onBack}
        onOpenRules={() => setModal('rules')}
        onOpenTournament={() => setModal('tournament')}
        onProfile={onProfile}
        onToggleSound={onToggleSound}
        onTopUp={onTopUp}
        soundOn={soundOn}
      />

      <section
        className="crash-stage"
        aria-label="Полёт воздушного шара"
        data-round-id={roundId}
        style={{ '--flight-y': flightPosition } as CSSProperties}
      >
        <CoefficientDisplay
          bet={bet}
          coefficient={round.coefficient}
          level={round.reachedLevels}
          status={round.status}
        />
        <LevelProgressTrack
          boosterLevel={round.mock.boosterLevel}
          boosterMultiplier={boosterMultiplier}
          levels={round.levels}
          progress={progress}
          reachedLevels={round.reachedLevels}
          theme={theme}
        />
        <BalloonFlight
          pointsPerLine={round.mock.pointsPerLine}
          reachedLevels={round.reachedLevels}
          status={round.status}
          theme={theme}
        />
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

      <Toast message={round.cashoutPayout > 0 && round.status !== 'crashed' ? 'Могли бы забрать больше' : ''} />
      {modal === 'rules' && <RulesModal onClose={() => setModal(null)} />}
      {modal === 'tournament' && <TournamentModal onClose={() => setModal(null)} />}
    </main>
  )
}

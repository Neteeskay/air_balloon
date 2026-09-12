import { useMemo, useState } from 'react'
import { AnimatedSkyBackground } from '../../../components/sky/AnimatedSkyBackground'
import { Toast } from '../../../components/ui/Toast'
import { BetSelectionHeader } from '../../betting/components/BetSelectionHeader'
import { RulesModal } from '../../betting/components/RulesModal'
import { TournamentModal } from '../../betting/components/TournamentModal'
import type { BetSelectionModal, Theme } from '../../betting/types'
import type { MockRound, MockUser } from '../../../mocks/mockGame'
import '../CrashGame.css'
import { BalloonFlight } from '../components/BalloonFlight'
import { CoefficientDisplay } from '../components/CoefficientDisplay'
import { CrashResultOverlay } from '../components/CrashResultOverlay'
import { CrashRoundPanel } from '../components/CrashRoundPanel'
import { DynamicFlightBackground } from '../components/DynamicFlightBackground'
import { LevelProgressTrack } from '../components/LevelProgressTrack'
import { useCrashRound } from '../hooks/useCrashRound'

type CrashGamePageProps = {
  round: MockRound
  user: MockUser
  onCashout: (multiplier: number) => void
  onFinish: () => void
  onBack: () => void
  onProfile: () => void
  onTopUp: () => void
}

export function CrashGamePage({
  round: activeRound,
  user,
  onCashout,
  onFinish,
  onBack,
  onProfile,
  onTopUp,
}: CrashGamePageProps) {
  const [modal, setModal] = useState<BetSelectionModal>(null)
  const [soundOn, setSoundOn] = useState(true)
  const theme: Theme = activeRound.theme
  const bet = activeRound.stake
  const boosterMultiplier = activeRound.booster
  const round = useCrashRound({
    bet,
    boosterMultiplier,
    crashAt: activeRound.crashMultiplier,
    initialCashoutCoefficient: activeRound.cashoutMultiplier,
    onCashout,
    onFinish: () => onFinish(),
    roundId: activeRound.id,
    soundOn,
    startedAt: activeRound.startedAt,
    theme,
  })
  const progress = useMemo(() => {
    const lastThreshold = round.levels[round.levels.length - 1]
    return Math.min(1, Math.max(0, (round.rawCoefficient - 1) / (lastThreshold - 1)))
  }, [round.levels, round.rawCoefficient])

  return (
    <main
      className={`game-shell crash-shell theme-${theme}`}
      onKeyDownCapture={() => undefined}
      onPointerDownCapture={() => undefined}
    >
      <div className="crash-scenery-blur" />
      <DynamicFlightBackground progress={progress} />
      <AnimatedSkyBackground />
      <BetSelectionHeader
        balance={user.balance}
        onOpenRules={() => setModal('rules')}
        onOpenTournament={() => setModal('tournament')}
        onToggleSound={() => setSoundOn((value) => !value)}
        onTopUp={onTopUp}
        onBack={onBack}
        onProfile={onProfile}
        soundOn={soundOn}
      />

      <section className="crash-stage" aria-label="Полёт воздушного шара" data-round-id={activeRound.id}>
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
          rawCoefficient={round.rawCoefficient}
          reachedLevels={round.reachedLevels}
          theme={theme}
        />
        <BalloonFlight
          pointsPerLine={round.mock.pointsPerLine}
          progress={progress}
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
          showCashoutHint={activeRound.status === 'flying' && activeRound.cashoutMultiplier === null}
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

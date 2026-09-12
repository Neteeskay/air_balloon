import { useMemo, useState } from 'react'
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
import type { CrashGameFinish } from '../types'

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
}: CrashGamePageProps) {
  const [modal, setModal] = useState<BetSelectionModal>(null)
  const round = useCrashRound({ bet, boosterMultiplier, onFinish, roundId, soundOn, theme })
  const progress = useMemo(() => {
    const lastThreshold = round.levels[round.levels.length - 1]
    return Math.min(1, Math.max(0, (round.rawCoefficient - 1) / (lastThreshold - 1)))
  }, [round.levels, round.rawCoefficient])

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
        onOpenRules={() => setModal('rules')}
        onOpenTournament={() => setModal('tournament')}
        onToggleSound={onToggleSound}
        onTopUp={onTopUp}
        soundOn={soundOn}
      />

      <section className="crash-stage" aria-label="Полёт воздушного шара" data-round-id={roundId}>
        {round.connection !== 'connected' && <div className="reconnect-banner" role="status">Восстанавливаем соединение…</div>}
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

import { HelpCircle } from 'lucide-react'
import { AnimatedSkyBackground } from '../../../components/sky/AnimatedSkyBackground'
import { useSkySounds } from '../../../components/sky/useSkySounds'
import { Toast } from '../../../components/ui/Toast'
import { BET_OPTIONS } from '../data/betOptions'
import { useBetSelection } from '../hooks/useBetSelection'
import { BetSelectionHeader } from '../components/BetSelectionHeader'
import { GameHistoryStrip } from '../components/GameHistoryStrip'
import { HeroBalloon } from '../components/HeroBalloon'
import { LevelsIndicator } from '../components/LevelsIndicator'
import { PuzzlePieceGrid } from '../components/PuzzlePieceGrid'
import { RulesModal } from '../components/RulesModal'
import { StartButton } from '../components/StartButton'
import { ThemeSwitcher } from '../components/ThemeSwitcher'
import { TournamentModal } from '../components/TournamentModal'
import { TournamentMobileBadge } from '../components/TournamentMobileBadge'
import type { Theme } from '../types'

type BetSelectionPageProps = {
  theme: Theme
  balance: number
  tournamentOpen?: boolean
  ratingOpen?: boolean
  onBack: () => void
  onThemeChange: (theme: Theme) => void
  onStart: (stake: number, booster: 1 | 2 | 3 | 4) => void
  onTopUp: () => void
  onOpenTournament: () => void
  onCloseTournament: () => void
}

export function BetSelectionPage({
  theme: initialTheme,
  balance: currentBalance,
  tournamentOpen = false,
  ratingOpen = false,
  onBack,
  onThemeChange,
  onStart,
  onTopUp,
  onOpenTournament,
  onCloseTournament,
}: BetSelectionPageProps) {
  const {
    balance,
    activatingId,
    boosterHintOpen,
    canStart,
    closeBoosterHint,
    closeModal,
    modal,
    notice,
    openRules,
    puzzleIds,
    selectedId,
    selectedMultiplier,
    selectOption,
    soundOn,
    startGame,
    switchTheme,
    theme,
    toggleSound,
    topUpBalance,
  } = useBetSelection({
    initialTheme,
    balance: currentBalance,
    onThemeChange,
    onStart,
    onTopUp,
  })
  const { unlockSkySounds } = useSkySounds({ enabled: soundOn })

  return (
    <main
      className={`game-shell theme-${theme}`}
      onKeyDownCapture={unlockSkySounds}
      onPointerDownCapture={unlockSkySounds}
    >
      <div className="sky-glow" />
      <AnimatedSkyBackground />
      <BetSelectionHeader
        balance={balance}
        onOpenRules={openRules}
        onOpenTournament={onOpenTournament}
        onToggleSound={toggleSound}
        onTopUp={topUpBalance}
        onBack={onBack}
        soundOn={soundOn}
      />

      <GameHistoryStrip />
      <LevelsIndicator
        boosterHintOpen={boosterHintOpen}
        multiplier={selectedMultiplier}
        onCloseBoosterHint={closeBoosterHint}
        theme={theme}
      />
      <HeroBalloon theme={theme} />
      <TournamentMobileBadge onClick={onOpenTournament} />

      <section className="bet-panel">
        <div className="panel-heading">
          <h1>Выбери фрагмент пазла</h1>
          <button className="hint-button" onClick={openRules} aria-label="Как работают фрагменты" type="button">
            <HelpCircle size={20} />
          </button>
          <ThemeSwitcher onSwitch={switchTheme} theme={theme} />
        </div>

        <PuzzlePieceGrid
          activatingId={activatingId}
          balance={balance}
          onSelect={selectOption}
          options={BET_OPTIONS}
          puzzleIds={puzzleIds}
          selectedId={selectedId}
        />

        <StartButton disabled={!canStart} onClick={startGame} />
      </section>

      <Toast message={notice} />
      {modal === 'rules' && <RulesModal onClose={closeModal} />}
      {(modal === 'tournament' || tournamentOpen || ratingOpen) && (
        <TournamentModal
          initialTab={tournamentOpen ? 'tournament' : 'rating'}
          onClose={modal === 'tournament' ? closeModal : onCloseTournament}
        />
      )}
    </main>
  )
}

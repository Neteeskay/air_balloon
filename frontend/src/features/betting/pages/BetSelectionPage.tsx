import { HelpCircle } from 'lucide-react'
import { AnimatedSkyBackground } from '../../../components/sky/AnimatedSkyBackground'
import { Toast } from '../../../components/ui/Toast'
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
import type { BetOption, Theme } from '../types'
import type { Api, User } from '../../../api/types'

type BetSelectionPageProps = {
  balance: number
  soundOn: boolean
  theme: Theme
  onStartGame: (round: { bet: number; boosterMultiplier: BetOption['multiplier'] }) => void
  onSwitchTheme: () => void
  onToggleSound: () => void
  onTopUp: () => void
  onUnlockAudio: () => void
  options: BetOption[]
  onBack?: () => void
  onProfile?: () => void
  onOpenDetailedRules?: () => void
  api?: Api
  currentUser?: User | null
}

export function BetSelectionPage({
  balance,
  soundOn,
  theme,
  onStartGame,
  onSwitchTheme,
  onToggleSound,
  onTopUp,
  onUnlockAudio,
  options,
  onBack,
  onProfile,
  onOpenDetailedRules,
  api,
  currentUser,
}: BetSelectionPageProps) {
  const {
    activatingId,
    canStart,
    closeModal,
    modal,
    notice,
    openRules,
    openTournament,
    puzzleIds,
    selectedId,
    selectOption,
    startGame,
    switchTheme,
    topUpBalance,
  } = useBetSelection({ balance, theme, onStartGame, onSwitchTheme, onTopUp, options })
  return (
    <main
      className={`game-shell theme-${theme}`}
      onKeyDownCapture={onUnlockAudio}
      onPointerDownCapture={onUnlockAudio}
    >
      <div className="sky-glow" />
      <AnimatedSkyBackground />
      <BetSelectionHeader
        balance={balance}
        onOpenRules={openRules}
        onOpenTournament={openTournament}
        onToggleSound={onToggleSound}
        onTopUp={topUpBalance}
        soundOn={soundOn}
        onBack={onBack}
        onProfile={onProfile}
        api={api}
      />

      <GameHistoryStrip api={api} currentUser={currentUser} />
      <LevelsIndicator
        theme={theme}
      />
      <HeroBalloon theme={theme} />
      <TournamentMobileBadge onClick={openTournament} />

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
          options={options}
          puzzleIds={puzzleIds}
          selectedId={selectedId}
        />

        <StartButton disabled={!canStart} onClick={startGame} />
      </section>

      <Toast message={notice} />
      {modal === 'rules' && <RulesModal onClose={closeModal} onOpenDetails={onOpenDetailedRules} />}
      {modal === 'tournament' && <TournamentModal api={api} onClose={closeModal} />}
    </main>
  )
}

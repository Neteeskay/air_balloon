import { ArrowLeft } from 'lucide-react'
import { BalanceDisplay } from './BalanceDisplay'
import { TopMenuActions } from './TopMenuActions'

type BetSelectionHeaderProps = {
  balance: number
  soundOn: boolean
  onOpenRules: () => void
  onOpenTournament: () => void
  onToggleSound: () => void
  onTopUp: () => void
  onBack: () => void
  onProfile: () => void
}

export function BetSelectionHeader({
  balance,
  soundOn,
  onOpenRules,
  onOpenTournament,
  onToggleSound,
  onTopUp,
  onBack,
  onProfile,
}: BetSelectionHeaderProps) {
  return (
    <header className="topbar">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={20} />
        <span>Назад</span>
      </button>

      <BalanceDisplay balance={balance} onTopUp={onTopUp} />

      <TopMenuActions
        onOpenRules={onOpenRules}
        onOpenTournament={onOpenTournament}
        onProfile={onProfile}
        onToggleSound={onToggleSound}
        soundOn={soundOn}
      />
    </header>
  )
}

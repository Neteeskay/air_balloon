import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { BalanceDisplay } from './BalanceDisplay'
import { TopMenuActions } from './TopMenuActions'
import { ProfileHistoryModal } from '../../history/ProfileHistoryModal'
import type { Api } from '../../../api/types'

type BetSelectionHeaderProps = {
  balance: number
  soundOn: boolean
  onOpenRules: () => void
  onOpenTournament: () => void
  onToggleSound: () => void
  onTopUp: () => void
  onBack?: () => void
  onProfile?: () => void
  api?: Api
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
  api,
}: BetSelectionHeaderProps) {
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <header className="topbar">
      <button className="back-button" type="button" onClick={onBack} aria-label="Назад">
        <ArrowLeft size={20} />
        <span>Назад</span>
      </button>

      <BalanceDisplay balance={balance} onTopUp={onTopUp} />

      <TopMenuActions
        onOpenRules={onOpenRules}
        onOpenTournament={onOpenTournament}
        onOpenHistory={() => setHistoryOpen(true)}
        onProfile={onProfile ?? (() => undefined)}
        onToggleSound={onToggleSound}
        soundOn={soundOn}
      />
      {historyOpen && <ProfileHistoryModal api={api} onClose={() => setHistoryOpen(false)} />}
    </header>
  )
}

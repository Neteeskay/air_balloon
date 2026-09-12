import { ArrowLeft, HelpCircle, UserRound, Volume2, VolumeX } from 'lucide-react'
import { IconButton } from '../../../components/ui/IconButton'
import { BalanceDisplay } from './BalanceDisplay'

type BetSelectionHeaderProps = {
  balance: number
  soundOn: boolean
  onOpenRules: () => void
  onOpenTournament: () => void
  onToggleSound: () => void
  onTopUp: () => void
  onBack?: () => void
  onProfile?: () => void
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
      <button className="back-button" type="button" onClick={onBack} aria-label="Назад">
        <ArrowLeft size={20} />
        <span>Назад</span>
      </button>

      <BalanceDisplay balance={balance} onTopUp={onTopUp} />

      <nav className="top-actions" aria-label="Дополнительные действия">
        <button className="tournament-button" onClick={onOpenTournament} type="button">
          <img alt="" className="tournament-icon" src="/assets/icons/кубок_старт.png" />
          <span><b>Турнир</b><small>25 дней</small></span>
        </button>
        <button className="rules-button" onClick={onOpenRules} type="button">
          <HelpCircle size={20} />
          <span>Правила</span>
        </button>
        <span className="divider" />
        <IconButton
          label={soundOn ? 'Выключить звук' : 'Включить звук'}
          onClick={onToggleSound}
          pressed={soundOn}
        >
          {soundOn ? <Volume2 size={23} /> : <VolumeX size={23} />}
        </IconButton>
        <IconButton label="Профиль" onClick={onProfile}>
          <UserRound size={23} />
        </IconButton>
      </nav>
    </header>
  )
}

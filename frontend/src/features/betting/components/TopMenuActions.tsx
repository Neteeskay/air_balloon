import { HelpCircle, UserRound, Volume2, VolumeX } from 'lucide-react'
import { IconButton } from '../../../components/ui/IconButton'

type TopMenuActionsProps = {
  soundOn: boolean
  onToggleSound: () => void
  onProfile: () => void
  onOpenRules?: () => void
  onOpenTournament?: () => void
  showTournament?: boolean
}

/** Shared action cluster used by the game and profile headers. */
export function TopMenuActions({
  soundOn,
  onToggleSound,
  onProfile,
  onOpenRules,
  onOpenTournament,
  showTournament = true,
}: TopMenuActionsProps) {
  return (
    <nav className="top-actions" aria-label="Дополнительные действия">
      {showTournament && onOpenTournament && (
        <button className="tournament-button" onClick={onOpenTournament} type="button">
          <img alt="" className="tournament-icon" src="/assets/icons/кубок_старт.png" />
          <span><b>Турнир</b><small>25 дней</small></span>
        </button>
      )}
      {onOpenRules && (
        <button className="rules-button" onClick={onOpenRules} type="button">
          <HelpCircle size={20} />
          <span>Правила</span>
        </button>
      )}
      {onOpenRules && <span className="divider" />}
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
  )
}

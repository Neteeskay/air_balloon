import { HelpCircle, History as HistoryIcon, Menu, UserRound, Volume2, VolumeX, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { IconButton } from '../../../components/ui/IconButton'
import './top-menu.css'

type TopMenuActionsProps = {
  soundOn: boolean
  onToggleSound: () => void
  onProfile: () => void
  onOpenRules?: () => void
  onOpenTournament?: () => void
  onOpenHistory?: () => void
  showTournament?: boolean
  onLogout?: () => void | Promise<void>
  profileMenuOpen?: boolean
  onToggleProfileMenu?: () => void
  onCloseProfileMenu?: () => void
}

/** Shared action cluster used by the game and profile headers. */
export function TopMenuActions({
  soundOn,
  onToggleSound,
  onProfile,
  onOpenRules,
  onOpenTournament,
  onOpenHistory,
  showTournament = true,
  onLogout,
  profileMenuOpen = false,
  onToggleProfileMenu,
  onCloseProfileMenu,
}: TopMenuActionsProps) {
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLElement>(null)
  const mobileMenuId = useId()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!profileMenuOpen || !onCloseProfileMenu) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) onCloseProfileMenu()
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [onCloseProfileMenu, profileMenuOpen])

  useEffect(() => {
    if (!mobileMenuOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!mobileMenuRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false)
        onCloseProfileMenu?.()
      }
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false)
        onCloseProfileMenu?.()
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [mobileMenuOpen, onCloseProfileMenu])

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
    onCloseProfileMenu?.()
  }
  const runMobileAction = (action?: () => void) => {
    closeMobileMenu()
    action?.()
  }
  const toggleMobileMenu = () => {
    setMobileMenuOpen((value) => !value)
    onCloseProfileMenu?.()
  }

  const profileButton = onLogout && onToggleProfileMenu ? (
    <div className="top-profile-menu-anchor" ref={profileMenuRef}>
      <button
        aria-expanded={profileMenuOpen}
        aria-haspopup="menu"
        aria-label="Профиль"
        className="icon-button"
        onClick={onToggleProfileMenu}
        type="button"
      >
        <UserRound size={23} />
        <span className="top-menu-link-label">Профиль</span>
      </button>
      {profileMenuOpen && (
        <div className="top-profile-menu" role="menu">
          <button role="menuitem" type="button" onClick={() => { onCloseProfileMenu?.(); void onLogout() }}>
            Выйти
          </button>
        </div>
      )}
    </div>
  ) : (
    <div className="top-profile-menu-anchor">
      <IconButton label="Профиль" onClick={() => runMobileAction(onProfile)}>
        <UserRound size={23} />
        <span className="top-menu-link-label">Профиль</span>
      </IconButton>
    </div>
  )

  return (
    <nav ref={mobileMenuRef} className="top-actions" aria-label="Дополнительные действия">
      <button
        aria-expanded={mobileMenuOpen}
        aria-haspopup="menu"
        aria-controls={mobileMenuId}
        aria-label={mobileMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
        className="top-menu-toggle"
        onClick={toggleMobileMenu}
        type="button"
      >
        {mobileMenuOpen ? <X size={23} /> : <Menu size={23} />}
      </button>
      <div id={mobileMenuId} aria-label="Меню навигации" className={`top-menu-links${mobileMenuOpen ? ' is-open' : ''}`}>
        {showTournament && onOpenTournament && (
          <button className="tournament-button" onClick={() => runMobileAction(onOpenTournament)} type="button">
            <img alt="" className="tournament-icon" src="/assets/icons/кубок_старт.png" />
            <span><b>Турнир</b><small>25 дней</small></span>
          </button>
        )}
        {onOpenHistory && (
          <IconButton label="Открыть историю игр" onClick={() => runMobileAction(onOpenHistory)}>
            <HistoryIcon size={21} />
            <span className="top-menu-link-label">История</span>
          </IconButton>
        )}
        {onOpenRules && (
          <button className="rules-button" onClick={() => runMobileAction(onOpenRules)} type="button">
            <HelpCircle size={20} />
            <span>Правила</span>
          </button>
        )}
        {onOpenRules && <span className="divider" />}
        {profileButton}
      </div>
      <div className="top-menu-sound">
        <IconButton
          label={soundOn ? 'Выключить звук' : 'Включить звук'}
          onClick={onToggleSound}
          pressed={soundOn}
        >
          {soundOn ? <Volume2 size={23} /> : <VolumeX size={23} />}
        </IconButton>
      </div>
    </nav>
  )
}

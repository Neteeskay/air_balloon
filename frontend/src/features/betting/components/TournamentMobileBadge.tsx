type TournamentMobileBadgeProps = {
  onClick: () => void
}

export function TournamentMobileBadge({ onClick }: TournamentMobileBadgeProps) {
  return (
    <button aria-label="Турнир. До конца турнира 25 дней" className="tournament-mobile-badge" onClick={onClick} type="button">
      <img alt="" src="/assets/icons/кубок_старт.png" />
      <span className="tournament-mobile-badge__label">25 ДНЕЙ</span>
      <strong>Турнир</strong>
    </button>
  )
}

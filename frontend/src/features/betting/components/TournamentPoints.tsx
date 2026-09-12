type TournamentPointsProps = {
  className?: string
}

export function TournamentPoints({ className = '' }: TournamentPointsProps) {
  return (
    <img
      alt=""
      className={`tournament-points-icon${className ? ` ${className}` : ''}`}
      src="/assets/icons/кубок_старт.png"
    />
  )
}

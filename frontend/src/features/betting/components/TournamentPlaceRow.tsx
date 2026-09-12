import { TrendingUp } from 'lucide-react'
import type { Ref } from 'react'
import type { TournamentParticipant } from '../types'
import { TournamentAvatar } from './TournamentAvatar'
import { TournamentPoints } from './TournamentPoints'

type TournamentPlaceRowProps = {
  participant: TournamentParticipant
  rowRef?: Ref<HTMLDivElement>
  showPlaceChange?: boolean
}

const pointsFormatter = new Intl.NumberFormat('ru-RU')

export function TournamentPlaceRow({ participant, rowRef, showPlaceChange = true }: TournamentPlaceRowProps) {
  return (
    <div className={`tournament-row${participant.isCurrentPlayer ? ' is-current-player' : ''}`} ref={rowRef}>
      <b className="tournament-place">{participant.place}</b>
      <span className="tournament-player">
        <TournamentAvatar {...participant} />
        <strong>{participant.name}</strong>
        {participant.isCurrentPlayer && <span className="you-badge">Вы</span>}
      </span>
      <span className="tournament-points">
        <TournamentPoints />
        <b>{pointsFormatter.format(participant.points)}</b>
      </span>
      {showPlaceChange && participant.placeChange && (
        <span className="place-change"><TrendingUp size={18} />+{participant.placeChange}</span>
      )}
    </div>
  )
}

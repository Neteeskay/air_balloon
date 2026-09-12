import type { TournamentParticipant } from '../types'
import { TournamentAvatar } from './TournamentAvatar'
import { TournamentPoints } from './TournamentPoints'

type TournamentTopThreeProps = {
  participants: TournamentParticipant[]
}

const crownByPlace: Record<number, string> = {
  1: '/assets/icons/tournament/place-1.png',
  2: '/assets/icons/tournament/place-2.png',
  3: '/assets/icons/tournament/place-3.png',
}

const pointsFormatter = new Intl.NumberFormat('ru-RU')

export function TournamentTopThree({ participants }: TournamentTopThreeProps) {
  const displayOrder = [participants[1], participants[0], participants[2]].filter(Boolean)

  return (
    <section className="tournament-podium" aria-label="Первые три места">
      {displayOrder.map((participant) => (
        <article className={`podium-card place-${participant.place}`} key={participant.id}>
          <img alt={`${participant.place} место`} className="place-crown" src={crownByPlace[participant.place]} />
          <TournamentAvatar {...participant} large />
          <div>
            <strong>{participant.name}</strong>
            <span><TournamentPoints />{pointsFormatter.format(participant.points)}</span>
            <small>очков</small>
          </div>
        </article>
      ))}
    </section>
  )
}

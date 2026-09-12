import { ChevronRight, Clock3 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { useCurrentPlayerVisibility } from '../hooks/useCurrentPlayerVisibility'
import { useRatingData } from '../hooks/useRatingData'
import { useTournamentData } from '../hooks/useTournamentData'
import { TournamentModalTabs, type TournamentTab } from './TournamentModalTabs'
import { TournamentPlaceRow } from './TournamentPlaceRow'
import { TournamentTopThree } from './TournamentTopThree'

type TournamentModalProps = {
  onClose: () => void
}

export function TournamentModal({ onClose }: TournamentModalProps) {
  const [activeTab, setActiveTab] = useState<TournamentTab>('rating')
  const tournament = useTournamentData()
  const rating = useRatingData()
  const activeData = activeTab === 'rating' ? rating : tournament
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentPlayerRowRef = useRef<HTMLDivElement>(null)
  const currentPlayerVisible = useCurrentPlayerVisibility(scrollRef, currentPlayerRowRef)
  const isTournament = activeTab === 'tournament'

  return (
    <Modal
      className="tournament-modal"
      closeOnSwipeDown
      onClose={onClose}
      beforeTitle={<TournamentModalTabs activeTab={activeTab} onChange={setActiveTab} />}
      title={(
        <span className="tournament-title">
          <img alt="" src="/assets/icons/кубок_старт.png" />
          <span>{isTournament ? 'Турнир высоты' : 'Рейтинг игроков'}</span>
          {isTournament && <small><i />Активен</small>}
        </span>
      )}
    >
      <div className={`tournament-intro${isTournament ? ' tournament-intro--tournament' : ''}`}>
        <p>{isTournament ? 'Стань лучшим среди игроков в этом месяце — набирай очки и поднимайся выше!' : activeData.description}</p>
        {isTournament && (
          <div className="tournament-timer">
            <Clock3 aria-hidden="true" size={30} />
            <span>До конца турнира:<b>{tournament.remainingTime}</b></span>
          </div>
        )}
      </div>
      <span className="tournament-rules">{isTournament ? 'Правила турнира' : 'Как формируется рейтинг'} <ChevronRight size={18} /></span>

      <TournamentTopThree participants={activeData.topThree} />

      <section className="tournament-table" aria-label={isTournament ? 'Таблица участников турнира' : 'Рейтинг игроков'}>
        <div className="tournament-table-heading">
          <span>Место</span><span>Игрок</span><span><img alt="" className="tournament-trophy-icon" src="/assets/icons/кубок_старт.png" />Игровые очки</span>
        </div>
        <div className="tournament-scroll" ref={scrollRef}>
          {activeData.otherParticipants.map((participant) => (
            <TournamentPlaceRow
              key={participant.id}
              participant={participant}
              rowRef={participant.isCurrentPlayer ? currentPlayerRowRef : undefined}
              showPlaceChange={!participant.isCurrentPlayer}
            />
          ))}
        </div>
      </section>

      <footer className={`current-player-sticky${currentPlayerVisible ? ' is-hidden' : ''}`} aria-hidden={currentPlayerVisible}>
        <TournamentPlaceRow participant={activeData.currentPlayer} />
      </footer>
    </Modal>
  )
}

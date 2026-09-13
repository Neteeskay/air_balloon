import { ChevronRight, Clock3 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Modal } from '../../../components/ui/Modal'
import { useCurrentPlayerVisibility } from '../hooks/useCurrentPlayerVisibility'
import { useTournamentData } from '../hooks/useTournamentData'
import { TournamentModalTabs, type TournamentTab } from './TournamentModalTabs'
import { TournamentPlaceRow } from './TournamentPlaceRow'
import { TournamentTopThree } from './TournamentTopThree'
import type { Api } from '../../../api/types'
import { api as defaultApi } from '../../../api'
import { adaptGlobalRating } from '../../rating/adapter'
import { useGlobalRating } from '../../rating/useGlobalRating'

type TournamentModalProps = {
  onClose: () => void
  initialTab?: TournamentTab
  api?: Api
}

export function TournamentModal({ onClose, initialTab = 'rating', api = defaultApi }: TournamentModalProps) {
  const [activeTab, setActiveTab] = useState<TournamentTab>(initialTab)
  const tournament = useTournamentData()
  const ratingQuery = useGlobalRating(api)
  const rating = ratingQuery.data ? adaptGlobalRating(ratingQuery.data) : null
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
        <p>{isTournament ? 'Стань лучшим среди игроков в этом месяце — набирай очки и поднимайся выше!' : activeData?.description}</p>
        {isTournament && (
          <div className="tournament-timer">
            <Clock3 aria-hidden="true" size={30} />
            <span>До конца турнира:<b>{tournament.remainingTime}</b></span>
          </div>
        )}
      </div>
      <span className="tournament-rules">{isTournament ? 'Правила турнира' : 'Как формируется рейтинг'} <ChevronRight size={18} /></span>

      {activeTab === 'rating' && ratingQuery.error ? <div className="tournament-data-state" role="alert"><p>{ratingQuery.error}</p><button className="secondary" type="button" onClick={ratingQuery.retry}>Повторить</button></div> : activeTab === 'rating' && ratingQuery.loading && !rating ? <p className="tournament-data-state" role="status">Загружаем рейтинг…</p> : activeData ? <>
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
      </> : null}
    </Modal>
  )
}

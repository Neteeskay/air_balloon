import { useRef } from 'react'
import type { Api } from '../../api/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TournamentPlaceRow } from '../betting/components/TournamentPlaceRow'
import { TournamentTopThree } from '../betting/components/TournamentTopThree'
import { adaptGlobalRating } from './adapter'
import { useGlobalRating } from './useGlobalRating'
import './rating.css'

export function RatingPage({ api, onBack }: { api: Api; onBack: () => void }) {
  const { data, error, loading, retry } = useGlobalRating(api)
  const scrollRef = useRef<HTMLDivElement>(null)
  const rating = data ? adaptGlobalRating(data) : null

  return (
    <main className="game-shell rating-page">
      <section className="rating-page__card" aria-labelledby="rating-page-title">
        <header className="rating-page__header">
          <button className="rating-page__back" type="button" onClick={onBack}><ChevronLeft size={20} />Назад</button>
          <div className="rating-page__title">
            <img alt="" src="/assets/icons/кубок_старт.png" />
            <div><h1 id="rating-page-title">Рейтинг игроков</h1><p>Общий рейтинг по игровым очкам</p></div>
          </div>
          <span className="rating-page__meta">Участников: {rating ? rating.totalParticipants : '—'}</span>
        </header>

        {error ? <div className="rating-page__state" role="alert"><p>{error}</p><button className="primary" type="button" onClick={retry}>Повторить</button></div> : loading && !rating ? <p className="rating-page__state" role="status">Загружаем рейтинг…</p> : rating ? <>
          <p className="rating-page__description">{rating.description}</p>
          <TournamentTopThree participants={rating.topThree} />
          <section className="tournament-table rating-page__table" aria-label="Рейтинг игроков">
            <div className="tournament-table-heading"><span>Место</span><span>Игрок</span><span>Игровые очки</span></div>
            <div className="tournament-scroll" ref={scrollRef}>
              {rating.otherParticipants.map((participant) => <TournamentPlaceRow key={participant.id} participant={participant} />)}
            </div>
          </section>
          <footer className="current-player-sticky"><TournamentPlaceRow participant={rating.currentPlayer} showPlaceChange={false} /></footer>
          <p className="rating-page__revision">Обновлено с сервера · revision {rating.revision}</p>
        </> : null}
      </section>
      <button className="rating-page__floating-back" type="button" onClick={onBack}><ChevronRight size={18} />Вернуться к выбору режима</button>
    </main>
  )
}

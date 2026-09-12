import { GAME_HISTORY } from '../data/gameHistory'

export function GameHistoryStrip() {
  return (
    <section className="history" aria-label="Прошлые игры">
      <span>Прошлые игры</span>
      <div className="history-list">
        {GAME_HISTORY.map((result, index) => (
          <span className={result >= 2 ? 'is-high' : ''} key={`${result}-${index}`}>
            {result.toFixed(2)}
          </span>
        ))}
      </div>
    </section>
  )
}

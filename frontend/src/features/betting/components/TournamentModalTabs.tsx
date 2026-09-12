export type TournamentTab = 'rating' | 'tournament'

type TournamentModalTabsProps = {
  activeTab: TournamentTab
  onChange: (tab: TournamentTab) => void
}

export function TournamentModalTabs({ activeTab, onChange }: TournamentModalTabsProps) {
  return (
    <div className="tournament-tabs" role="tablist" aria-label="Раздел таблицы">
      <button
        aria-selected={activeTab === 'rating'}
        className={activeTab === 'rating' ? 'is-active' : ''}
        onClick={() => onChange('rating')}
        role="tab"
        type="button"
      >
        Рейтинг
      </button>
      <button
        aria-selected={activeTab === 'tournament'}
        className={activeTab === 'tournament' ? 'is-active' : ''}
        onClick={() => onChange('tournament')}
        role="tab"
        type="button"
      >
        Турнир
      </button>
    </div>
  )
}

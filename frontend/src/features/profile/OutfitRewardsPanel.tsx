import type { OutfitRewardStatus } from '../../api/types'

export type OutfitRewardsState =
  | { status: 'loading'; items: OutfitRewardStatus[] }
  | { status: 'ready'; items: OutfitRewardStatus[] }
  | { status: 'error'; items: OutfitRewardStatus[] }

const amount = (value: number) => new Intl.NumberFormat('ru-RU').format(value)

export function OutfitRewardsPanel({ state, onRetry }: { state?: OutfitRewardsState; onRetry?: () => void }) {
  const current = state ?? { status: 'ready' as const, items: [] }
  return <section className="av-outfit-rewards" aria-labelledby="av-outfit-rewards-title">
    <div className="av-collections-heading">
      <h2 id="av-outfit-rewards-title"><span aria-hidden="true">🎁</span> Награды за образы</h2>
      {current.status === 'ready' && current.items.length > 0 && <p>{current.items.length} комплект{current.items.length === 1 ? '' : 'а'} с сервера</p>}
    </div>
    {current.status === 'loading' && <p className="av-outfit-rewards-state" role="status">Загружаем награды…</p>}
    {current.status === 'error' && <div className="av-outfit-rewards-state" role="alert"><p>Не удалось загрузить награды за образы.</p>{onRetry && <button type="button" onClick={onRetry}>Повторить</button>}</div>}
    {current.status === 'ready' && current.items.length === 0 && <p className="av-outfit-rewards-state">Награды за образы пока недоступны.</p>}
    {current.status === 'ready' && current.items.length > 0 && <div className="av-outfit-rewards-list">
      {current.items.map((reward) => <article className="av-outfit-reward" key={reward.code}>
        <div className="av-outfit-reward-heading"><h3>{reward.title || reward.code}</h3><span className={`av-outfit-reward-status ${reward.claimed ? 'is-claimed' : reward.completed ? 'is-completed' : ''}`}>
          {reward.claimed ? 'Получено' : reward.completed ? 'Выполнено' : 'В процессе'}
        </span></div>
        <p className="av-outfit-reward-condition">{reward.completed ? 'Комплект собран' : 'Комплект ещё не собран'}</p>
        <p className="av-outfit-reward-amount">Награда: <strong>+{amount(reward.rewardAmount)} бонусов</strong></p>
      </article>)}
    </div>}
  </section>
}

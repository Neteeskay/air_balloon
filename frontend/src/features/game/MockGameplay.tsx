import { useEffect, useMemo, useState } from 'react'
import type { MockRound, MockUser } from '../../mocks/mockGame'
import './MockGameplay.css'

type Props = {
  round: MockRound
  user: MockUser
  onCashout: (multiplier: number) => void
  onComplete: () => void
  onBack: () => void
  onProfile: () => void
}

const format = (value: number) => value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
const multiplier = (value: number) => `×${value.toFixed(2)}`

export function MockGameplay({ round, user, onCashout, onComplete, onBack, onProfile }: Props) {
  const totalLevels = round.theme === 'green' ? 9 : 12
  const [now, setNow] = useState(() => Date.now())
  const [crashed, setCrashed] = useState(round.status === 'finished')

  useEffect(() => {
    if (round.status === 'finished') return
    const timer = window.setInterval(() => setNow(Date.now()), 100)
    return () => window.clearInterval(timer)
  }, [round.status])

  const elapsed = Math.max(0, now - round.startedAt)
  const progress = Math.min(1, elapsed / round.crashAfterMs)
  const currentLevel = Math.min(totalLevels, Math.floor(progress * totalLevels))
  const baseMultiplier = Math.min(round.crashMultiplier, 1 + progress * (round.crashMultiplier - 1))
  const boosterActive = round.booster > 1 && currentLevel >= 3 && round.status !== 'flying'
  const currentMultiplier = Math.min(round.crashMultiplier * (boosterActive ? round.booster : 1), baseMultiplier * (boosterActive ? round.booster : 1))
  const canCashout = round.status === 'flying' && currentLevel >= 1 && !crashed
  const boosterLevel = Math.max(3, Math.ceil(totalLevels * 0.55))

  useEffect(() => {
    if (round.status === 'finished' || crashed || elapsed < round.crashAfterMs) return
    setCrashed(true)
  }, [crashed, elapsed, round.crashAfterMs, round.status])

  useEffect(() => {
    if (!crashed || round.status === 'finished') return
    const timer = window.setTimeout(onComplete, 900)
    return () => window.clearTimeout(timer)
  }, [crashed, onComplete, round.status])

  const levels = useMemo(() => Array.from({ length: totalLevels }, (_, index) => index + 1), [totalLevels])
  const balloon = round.theme === 'green' ? '/assets/flight-mode/balloon-green.png' : '/assets/flight-mode/balloon-red.png'
  const outcomeLabel = round.status === 'cashed-out' ? 'ВЫИГРЫШ ЗАФИКСИРОВАН' : crashed ? 'ШАР ЛОПНУЛ' : 'ТЕКУЩИЙ КОЭФФИЦИЕНТ'

  return (
    <main className={`mock-gameplay theme-${round.theme}`} data-testid="active-round">
      <header className="gameplay-header">
        <button type="button" className="gameplay-back" onClick={onBack}>← К ставке</button>
        <div className="gameplay-brand">AIR BALLOON <span>● MOCK</span></div>
        <button type="button" className="gameplay-profile" onClick={onProfile} aria-label="Открыть профиль">
          <strong>{user.displayName}</strong><span>{format(user.balance)} бонусов</span>
        </button>
      </header>

      <section className="gameplay-layout">
        <div className="gameplay-stage" aria-label="Игровое поле">
          <div className="gameplay-sun" />
          <div className="gameplay-cloud gameplay-cloud-one" />
          <div className="gameplay-cloud gameplay-cloud-two" />
          <div className="altitude-grid" aria-hidden="true">{[1, 2, 3, 4, 5].map((line) => <i key={line} />)}</div>
          <div className="gameplay-multiplier">
            <span>{outcomeLabel}</span>
            <strong data-testid="multiplier">{multiplier(round.status === 'cashed-out' ? (round.cashoutMultiplier ?? currentMultiplier) : currentMultiplier)}</strong>
            <small>Уровень {currentLevel} из {totalLevels}</small>
          </div>
          <div className={`gameplay-balloon ${crashed ? 'is-crashed' : ''} ${round.status === 'cashed-out' ? 'is-cashed-out' : ''}`} style={{ bottom: `${12 + progress * 58}%` }}>
            <img src={balloon} alt="Воздушный шар в полёте" />
            {crashed && <b aria-hidden="true">✷</b>}
          </div>
          <div className="level-rail" aria-label="Уровни полёта">
            {levels.map((level) => {
              const isBooster = round.booster > 1 && level === boosterLevel
              return <div key={level} className={level <= currentLevel ? 'passed' : ''}>
                <span>{String(level).padStart(2, '0')}</span><i />
                {isBooster && <b data-testid="booster-marker" title={`Бустер ×${round.booster}`}>×{round.booster}</b>}
              </div>
            })}
          </div>
          <div className="gameplay-toast" role="status">
            {round.status === 'cashed-out' ? `Выплата ${format(round.stake * (round.cashoutMultiplier ?? 1))} бонусов сохранена` : crashed ? 'Результат готовим…' : canCashout ? 'Можно зафиксировать выигрыш' : 'Cashout доступен после первого уровня'}
          </div>
        </div>

        <aside className="gameplay-panel">
          <div className="round-summary"><span>{round.theme.toUpperCase()} · {totalLevels} уровней</span><strong>Раунд {round.id.replace('mock-', '#')}</strong></div>
          <div className="gameplay-stats">
            <div><span>Ставка</span><strong>{format(round.stake)}</strong></div>
            <div><span>Бустер</span><strong>{round.booster === 1 ? '×1' : `×${round.booster}`}</strong><small>{round.booster === 1 ? 'без усиления' : 'маркер на поле'}</small></div>
            <div><span>Баланс</span><strong>{format(user.balance)}</strong></div>
          </div>
          {round.status === 'cashed-out' ? (
            <div className="cashout-locked" role="status"><strong>Выигрыш зафиксирован</strong><span>{format(round.stake * (round.cashoutMultiplier ?? 1))} бонусов · {multiplier(round.cashoutMultiplier ?? 1)}</span><small>Шар продолжает полёт до падения.</small></div>
          ) : (
            <button className="cashout-button" data-testid="cashout-button" type="button" disabled={!canCashout} onClick={() => onCashout(currentMultiplier)}>
              <span>{crashed ? 'Полёт завершён' : `Забрать ${format(round.stake * currentMultiplier)} бонусов`}</span><strong>{multiplier(currentMultiplier)}</strong>
            </button>
          )}
          <p className="gameplay-note">Демо-раунд на локальных mock-данных. Сумма и результат не являются реальными выплатами.</p>
          <button type="button" className="fairness-button" onClick={() => undefined}>◇ Проверить честность</button>
        </aside>
      </section>
    </main>
  )
}

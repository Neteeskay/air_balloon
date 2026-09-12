import { CloudSun, ShieldCheck, Sparkles } from 'lucide-react'
import type { MockRound, MockUser } from '../../mocks/mockGame'
import './MockGameplayBridge.css'

type MockGameplayBridgeProps = {
  round: MockRound
  user: MockUser
  onWin: () => void
  onLoss: () => void
  onBack: () => void
  onProfile: () => void
}

export function MockGameplayBridge({ round, user, onWin, onLoss, onBack, onProfile }: MockGameplayBridgeProps) {
  return (
    <main className={`mock-game theme-${round.theme}`}>
      <div className="mock-game__clouds" aria-hidden="true" />
      <header className="mock-game__header">
        <button type="button" onClick={onBack}>← К ставке</button>
        <button className="mock-game__profile" type="button" onClick={onProfile} aria-label="Открыть профиль">
          <span>{user.displayName}</span>
          <strong>{user.balance} бонусов</strong>
        </button>
      </header>

      <section className="mock-game__stage" aria-labelledby="mock-game-title">
        <span className="mock-game__badge"><ShieldCheck size={16} /> MOCK-РАУНД</span>
        <CloudSun className="mock-game__weather" aria-hidden="true" />
        <img
          className="mock-game__balloon"
          src={round.theme === 'green' ? '/assets/flight-mode/balloon-green.png' : '/assets/flight-mode/balloon-red.png'}
          alt="Воздушный шар в полёте"
        />
        <h1 id="mock-game-title">Проверка результата полёта</h1>
        <p>
          Ставка <b>{round.stake}</b> · бустер <b>×{round.booster}</b> · режим <b>{round.theme.toUpperCase()}</b>
        </p>
        <div className="mock-game__notice">
          <Sparkles size={19} aria-hidden="true" />
          Gameplay в исходных frontend-ветках отсутствует. Этот экран — временный mock bridge для проверки полного flow.
        </div>
        <div className="mock-game__actions" aria-label="Выбрать mock-результат">
          <button className="mock-game__win" type="button" onClick={onWin}>Завершить победой</button>
          <button className="mock-game__loss" type="button" onClick={onLoss}>Смоделировать проигрыш</button>
        </div>
      </section>
    </main>
  )
}

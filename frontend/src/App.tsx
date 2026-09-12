import { useState } from 'react'
import { BetSelectionPage } from './features/betting/pages/BetSelectionPage'
import { CrashGamePage } from './features/game/pages/CrashGamePage'
import { useGameSession } from './features/game/hooks/useGameSession'
import { useSkySounds } from './components/sky/useSkySounds'

export function App() {
  const game = useGameSession()
  const { unlockSkySounds } = useSkySounds({
    enabled: game.soundOn,
    flightActive: Boolean(game.round),
  })

  if (game.loading) return <main className="game-shell"><p role="status">Готовим ваш полёт…</p></main>
  if (!game.user) return <Login onLogin={game.login} error={game.error} />
  if (!game.round && game.result) return <ResultCard result={game.result} onAgain={game.clearResult} />
  if (game.round) {
    return (
      <CrashGamePage
        balance={game.balance}
        bet={game.round.bet}
        boosterMultiplier={game.round.boosterMultiplier}
        onFinish={game.finishRound}
        onToggleSound={game.toggleSound}
        onTopUp={game.topUpBalance}
        onUnlockAudio={unlockSkySounds}
        roundId={game.round.roundId}
        showCashoutHint={game.round.showCashoutHint}
        soundOn={game.soundOn}
        theme={game.theme}
      />
    )
  }

  return (
      <BetSelectionPage
      balance={game.balance}
      onStartGame={game.startRound}
      onSwitchTheme={game.switchTheme}
      onToggleSound={game.toggleSound}
      onTopUp={game.topUpBalance}
      onUnlockAudio={unlockSkySounds}
      soundOn={game.soundOn}
        theme={game.theme}
        options={game.betOptions}
    />
  )
}

function ResultCard({ result, onAgain }: { result: any; onAgain: () => void }) {
  const won = result.result === 'WIN'
  return <main className={`game-shell result-shell ${won ? 'win' : 'loss'}`}><section className="result-card"><p className="eyebrow">ПОЛЁТ ЗАВЕРШЁН</p><h1>{won ? 'Отлично поймали момент!' : 'В этот раз — чуть выше риска'}</h1><div className="result-amount">{won ? `+${Number(result.winAmount).toLocaleString('ru-RU')}` : '0'} <span>бонусов</span></div><dl><div><dt>Cashout</dt><dd>{result.cashoutMultiplier ? `×${Number(result.cashoutMultiplier).toFixed(2)}` : 'Не выполнен'}</dd></div><div><dt>Crash</dt><dd>×{Number(result.crashMultiplier).toFixed(2)}</dd></div><div><dt>Игровые очки</dt><dd>{result.score}</dd></div>{result.playerCharacter && <div><dt>Ваш стиль</dt><dd>{result.playerCharacter.title}</dd></div>}{result.reward && <div><dt>Награда</dt><dd>Получен фрагмент · {result.reward.currentFragments ?? ''}/{result.reward.totalFragments ?? ''}</dd></div>}</dl><button className="primary" onClick={onAgain}>Играть снова ↗</button></section></main>
}

function Login({ onLogin, error }: { onLogin: (login: string, password: string) => Promise<unknown>; error: string }) {
  const [login, setLogin] = useState(''); const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(error)
  return <main className="game-shell login-shell"><section className="login-card"><p className="eyebrow">ВОЗДУШНЫЙ ШАР / FLIGHT CLUB</p><h1>Выше облаков.<br /><em>Ближе к победе.</em></h1><p>Ваш следующий полёт начинается здесь.</p><form onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setMessage(''); try { await onLogin(login, password) } catch (err) { setMessage(err instanceof Error ? err.message : 'Не удалось войти') } finally { setBusy(false) } }}><label>Логин<input required autoComplete="username" value={login} onChange={e => setLogin(e.target.value)} /></label><label>Пароль<input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>{message && <p className="error" role="alert">{message}</p>}<button className="primary" disabled={busy}>{busy ? 'Входим…' : 'Войти ↗'}</button></form></section></main>
}

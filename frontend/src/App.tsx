import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import type { Result, User } from './api/types'
import { LandingPage } from './features/landing/pages/LandingPage'
import { BetSelectionPage } from './features/betting/pages/BetSelectionPage'
import { CrashGamePage } from './features/game/pages/CrashGamePage'
import { useGameSession } from './features/game/hooks/useGameSession'
import { useSkySounds } from './components/sky/useSkySounds'
import LoginPage from './pages/LoginPage'
import FlightModePage, { type FlightMode } from './pages/FlightModePage'
import { ResultScreen } from './features/results'
import type { ResultScreenData } from './types/result'
import { RealProfilePage } from './features/profile/RealProfilePage'
import { RatingPage } from './features/rating/RatingPage'
import { unlockCrashAudio } from './features/game/hooks/useCrashSounds'
import { APP_BACKGROUND_MUSIC_VOLUME, backgroundMusic } from './audio/backgroundMusic'
import { adaptRoundResult } from './services/resultAdapter'

const pathOf = () => window.location.pathname.replace(/\/+$/, '') || '/'

export function App() {
  useEffect(() => {
    backgroundMusic.mount()
    backgroundMusic.setVolume(APP_BACKGROUND_MUSIC_VOLUME)
    return () => backgroundMusic.unmount()
  }, [])

  const game = useGameSession()
  const [path, setPath] = useState(pathOf)
  const { unlockSkySounds } = useSkySounds({ enabled: game.soundOn, flightActive: Boolean(game.round) })
  const unlockAudio = useCallback(() => { backgroundMusic.unlock(); unlockSkySounds(); unlockCrashAudio() }, [unlockSkySounds])
  useEffect(() => { const onPop = () => setPath(pathOf()); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop) }, [])
  const navigate = useCallback((next: string, replace = false) => { (replace ? window.history.replaceState : window.history.pushState).call(window.history, null, '', next); setPath(next); window.scrollTo(0, 0) }, [])
  useEffect(() => { if (!game.loading && !game.user && path !== '/' && path !== '/login') navigate('/login', true) }, [game.loading, game.user, navigate, path])
  if (game.loading) return <main className="game-shell" role="status"><p>Готовим ваш полёт…</p></main>
  if (path === '/') return <LandingPage onPlay={() => navigate(game.user ? '/mode' : '/login')} onUnlockAudio={unlockAudio} />
  if (!game.user) return <LoginPage onAuthenticated={async (login, password) => { await game.login(login, password); navigate('/mode', true) }} onBack={() => navigate('/')} />
  if (path === '/login') { navigate('/mode', true); return null }
  if (path === '/mode') return <FlightModePage currentUser={game.user} onUnlockAudio={unlockAudio} soundOn={game.soundOn} onLogout={async () => { await game.logout(); navigate('/login', true) }} onModeSelected={(mode: FlightMode) => { if (game.theme !== mode.toLowerCase()) game.switchTheme(); navigate('/bet') }} onProfile={() => navigate('/profile')} onOpenRating={() => navigate('/rating')} />
  if (path === '/profile') return <RealProfilePage api={api} user={game.user} balance={game.balance} onClose={() => navigate('/mode')} onLogout={async () => { await game.logout(); navigate('/login', true) }} onOpenRating={() => navigate('/rating')} onToggleSound={game.toggleSound} soundOn={game.soundOn} />
  if (path === '/rating') return <RatingPage api={api} onBack={() => navigate('/mode')} />
  if (path === '/tournament') return <DataPanel title="Турнир пилотов" load={() => api.tournament.getActive()} onBack={() => navigate('/bet')} />
  if (path === '/game' && game.round) return <CrashGamePage api={api} balance={game.balance} bet={game.round.bet} boosterMultiplier={game.round.boosterMultiplier} onFinish={async () => { const final = await game.finishRound(); navigate(final?.result === 'LOSS' ? '/result/loss' : '/result/win') }} onToggleSound={game.toggleSound} onTopUp={game.topUpBalance} onUnlockAudio={unlockSkySounds} roundId={game.round.roundId} showCashoutHint={game.round.showCashoutHint} soundOn={game.soundOn} theme={game.theme} onBack={() => navigate('/bet')} onProfile={() => navigate('/profile')} />
  if ((path === '/result/win' || path === '/result/loss') && game.result) return <ResultView result={game.result} user={game.user} balance={game.balance} theme={game.theme} onAgain={() => { game.clearResult(); navigate('/bet') }} onRepeatBet={async () => { await game.repeatBet(); navigate('/game') }} onProfile={() => navigate('/profile')} onMenu={() => navigate('/mode')} />
  if (path === '/game' || path === '/result/win' || path === '/result/loss') { navigate('/bet', true); return null }
  return <BetSelectionPage api={api} balance={game.balance} soundOn={game.soundOn} theme={game.theme} options={game.betOptions} onStartGame={async selection => { unlockAudio(); await game.startRound(selection); navigate('/game') }} onSwitchTheme={game.switchTheme} onToggleSound={game.toggleSound} onTopUp={game.topUpBalance} onUnlockAudio={unlockAudio} onBack={() => navigate('/mode')} onProfile={() => navigate('/profile')} />
}

function ResultView({ result, user, balance, theme, onAgain, onRepeatBet, onProfile, onMenu }: { result: Result; user: User; balance: number; theme: 'green'|'red'; onAgain: () => void; onRepeatBet: () => Promise<void>; onProfile: () => void; onMenu: () => void }) {
  const data: ResultScreenData = adaptRoundResult({
    ...result,
    theme,
    bonusBalance: result.balanceAfter ?? balance,
    playerName: user.name,
    canRepeatBet: true,
  })
  return <ResultScreen data={data} actions={{ onPlayAgain: onAgain, onRepeatBet, onHome: onMenu, onAutoReturn: onAgain, onMenu, onProfile }} />
}

function DataPanel({ title, load, onBack }: { title: string; load: () => Promise<unknown>; onBack: () => void }) {
  const [data, setData] = useState<unknown>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    void load().then(value => live && setData(value)).catch(value => live && setError(value instanceof Error ? value.message : 'Не удалось загрузить данные'))
    return () => { live = false }
  }, [load])
  return <main className="game-shell" style={{ padding: '2rem' }}><button className="primary" onClick={onBack}>← Назад</button><h1>{title}</h1>{error ? <p role="alert" className="error">{error}</p> : <pre style={{ whiteSpace: 'pre-wrap' }}>{data ? JSON.stringify(data, null, 2) : 'Загрузка…'}</pre>}</main>
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { AvatarProfile } from '../features/avatar/AvatarProfile'
import { BetSelectionPage } from '../features/betting/pages/BetSelectionPage'
import { MockGameplayBridge } from '../features/game/MockGameplayBridge'
import { LandingPage } from '../features/landing/pages/LandingPage'
import { ResultScreen } from '../features/results'
import {
  EMPTY_MOCK_STATE,
  beginMockRound,
  clearMockRound,
  createMockUser,
  finishMockRound,
  readMockState,
  saveMockAvatar,
  writeMockState,
  type MockTheme,
} from '../mocks/mockGame'
import FlightModePage, { type FlightMode } from '../pages/FlightModePage'
import LoginPage from '../pages/LoginPage'
import type { CurrentUser } from '../types/auth'
import type { RoundOutcome } from '../types/result'

const KNOWN_ROUTES = new Set([
  '/', '/login', '/mode', '/bet', '/game', '/result/win', '/result/loss', '/tournament', '/rating', '/profile',
])

function currentPath() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  return KNOWN_ROUTES.has(path) ? path : '/'
}

function Redirect({ to, navigate }: { to: string; navigate: (path: string, replace?: boolean) => void }) {
  useEffect(() => navigate(to, true), [navigate, to])
  return null
}

export default function App() {
  const [path, setPath] = useState(currentPath)
  const [state, setState] = useState(readMockState)
  const profileReturnPath = useRef('/mode')

  useEffect(() => {
    const onPopState = () => setPath(currentPath())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => writeMockState(state), [state])

  useEffect(() => {
    document.body.style.overflow = path === '/' ? 'auto' : 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [path])

  const navigate = useCallback((nextPath: string, replace = false) => {
    if (replace) window.history.replaceState(null, '', nextPath)
    else if (window.location.pathname !== nextPath) window.history.pushState(null, '', nextPath)
    setPath(nextPath)
    window.scrollTo({ top: 0, left: 0 })
  }, [])

  const openProfile = useCallback(() => {
    profileReturnPath.current = path === '/profile' ? '/mode' : path
    navigate('/profile')
  }, [navigate, path])

  const authenticate = (user: CurrentUser) => {
    setState((current) => ({ ...current, currentUser: createMockUser(user) }))
    navigate('/mode')
  }

  const selectMode = (mode: FlightMode) => {
    const selectedTheme: MockTheme = mode === 'GREEN' ? 'green' : 'red'
    setState((current) => ({
      ...current,
      selectedTheme,
      selectedStake: null,
      selectedBooster: null,
      mockRound: null,
      mockResult: null,
    }))
    navigate('/bet')
  }

  const startRound = (stake: number, booster: 1 | 2 | 3 | 4) => {
    setState((current) => beginMockRound(current, stake, booster))
    navigate('/game')
  }

  const finishRound = (outcome: RoundOutcome) => {
    setState((current) => finishMockRound(current, outcome))
    navigate(`/result/${outcome}`)
  }

  const returnToBet = () => {
    setState((current) => clearMockRound(current))
    navigate('/bet')
  }

  if (path === '/') return <LandingPage onPlay={() => navigate('/login')} />
  if (path === '/login') return <LoginPage onAuthenticated={authenticate} onBack={() => navigate('/')} />

  if (!state.currentUser) return <Redirect to="/login" navigate={navigate} />

  if (path === '/mode') {
    return (
      <FlightModePage
        currentUser={state.currentUser}
        onLogout={() => {
          setState(EMPTY_MOCK_STATE)
          navigate('/')
        }}
        onModeSelected={selectMode}
        onProfile={openProfile}
        onOpenRating={() => {
          setState((current) => ({ ...current, selectedTheme: current.selectedTheme ?? 'green' }))
          navigate('/rating')
        }}
      />
    )
  }

  if ((path === '/bet' || path === '/tournament' || path === '/rating') && state.selectedTheme) {
    return (
      <BetSelectionPage
        key={state.selectedTheme}
        theme={state.selectedTheme}
        balance={state.currentUser.balance}
        tournamentOpen={path === '/tournament'}
        ratingOpen={path === '/rating'}
        onBack={() => navigate('/mode')}
        onProfile={openProfile}
        onThemeChange={(selectedTheme) => setState((current) => ({ ...current, selectedTheme }))}
        onStart={startRound}
        onTopUp={() => setState((current) => current.currentUser ? ({
          ...current,
          currentUser: { ...current.currentUser, balance: current.currentUser.balance + 50 },
        }) : current)}
        onOpenTournament={() => navigate('/tournament')}
        onCloseTournament={() => navigate(path === '/rating' ? '/mode' : '/bet')}
      />
    )
  }

  if (path === '/game' && state.mockRound) {
    return (
      <MockGameplayBridge
        round={state.mockRound}
        user={state.currentUser}
        onWin={() => finishRound('win')}
        onLoss={() => finishRound('loss')}
        onBack={returnToBet}
        onProfile={openProfile}
      />
    )
  }

  if ((path === '/result/win' || path === '/result/loss') && state.mockResult) {
    return (
      <ResultScreen
        data={state.mockResult}
        autoReturnSeconds={30}
        actions={{
          onPlayAgain: returnToBet,
          onRepeatBet: () => {
            if (!state.selectedStake || !state.selectedBooster || state.currentUser!.balance < state.selectedStake) {
              return Promise.reject(new Error('Insufficient mock balance'))
            }
            setState((current) => beginMockRound(clearMockRound(current), state.selectedStake!, state.selectedBooster!))
            navigate('/game')
          },
          onHome: () => {
            setState((current) => clearMockRound(current))
            navigate('/')
          },
          onAutoReturn: returnToBet,
          onMenu: () => navigate('/mode'),
          onProfile: openProfile,
        }}
      />
    )
  }

  if (path === '/profile') {
    const puzzle = state.currentUser.puzzles[0]
    return (
      <AvatarProfile
        userName={state.currentUser.displayName}
        balance={state.currentUser.balance}
        score={state.currentUser.score}
        petName={state.currentUser.petName}
        puzzle={puzzle}
        unlockedClothingIds={state.currentUser.unlockedClothingIds}
        equippedClothing={state.currentUser.equippedClothing}
        onSave={(petName, equipped) => setState((current) => saveMockAvatar(current, petName, equipped))}
        onClose={() => navigate(profileReturnPath.current)}
      />
    )
  }

  return <Redirect to={state.selectedTheme ? '/bet' : '/mode'} navigate={navigate} />
}

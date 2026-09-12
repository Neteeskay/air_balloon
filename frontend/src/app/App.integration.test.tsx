import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MOCK_STATE_KEY } from '../mocks/mockGame'
import App from './App'

vi.mock('../features/landing/pages/LandingPage', () => ({
  LandingPage: ({ onPlay }: { onPlay: () => void }) => <button onClick={onPlay}>Landing Play</button>,
}))

vi.mock('../pages/LoginPage', () => ({
  default: ({ onAuthenticated, onBack }: any) => (
    <><button onClick={() => onAuthenticated({ userId: 'demo', displayName: 'Demo' })}>Mock Login</button><button onClick={onBack}>Login Back</button></>
  ),
}))

vi.mock('../pages/FlightModePage', () => ({
  default: ({ onModeSelected, onOpenRating, onProfile, onLogout }: any) => (
    <><button onClick={() => onModeSelected('GREEN')}>Green</button><button onClick={() => onModeSelected('RED')}>Red</button><button onClick={onOpenRating}>Rating</button><button onClick={onProfile}>Mode Profile</button><button onClick={onLogout}>Logout</button></>
  ),
}))

vi.mock('../features/betting/pages/BetSelectionPage', () => ({
  BetSelectionPage: ({ onStart, onOpenTournament, onCloseTournament, onProfile, tournamentOpen, ratingOpen }: any) => (
    <>
      <span>Bet Screen</span>
      <button onClick={() => onStart(15, 2)}>Start</button>
      <button onClick={onOpenTournament}>Tournament</button>
      <button onClick={onProfile}>Bet Profile</button>
      {(tournamentOpen || ratingOpen) && <button onClick={onCloseTournament}>Close Table</button>}
    </>
  ),
}))

vi.mock('../features/game/MockGameplay', () => ({
  MockGameplay: ({ onCashout, onComplete, onProfile }: any) => <><button onClick={() => { onCashout(2.2); onComplete('win') }}>WIN</button><button onClick={() => onComplete('loss')}>LOSS</button><button onClick={onProfile}>Game Profile</button></>,
}))

vi.mock('../features/results', () => ({
  ResultScreen: ({ data, actions }: any) => <><span>{data.result} Result</span><span>{data.reward.collectedFragments} / {data.reward.totalFragments}</span><button onClick={() => actions.onPlayAgain(data.theme)}>Play Again</button><button onClick={actions.onProfile}>Result Profile</button></>,
}))

vi.mock('../features/avatar/AvatarProfile', () => ({
  AvatarProfile: ({ puzzle, equippedClothing, onClose }: any) => <><span>Profile Screen</span><span>{puzzle.collectedFragments} / {puzzle.totalFragments}</span><span>Equipped {equippedClothing.neckId}</span><button onClick={onClose}>Profile Back</button></>,
}))

function loginAndChoose(mode: 'Green' | 'Red') {
  fireEvent.click(screen.getByText('Landing Play'))
  expect(window.location.pathname).toBe('/login')
  fireEvent.click(screen.getByText('Mock Login'))
  expect(window.location.pathname).toBe('/mode')
  fireEvent.click(screen.getByText(mode))
  expect(window.location.pathname).toBe('/bet')
}

describe('full mock application flow', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('connects Landing → Login → GREEN → Bet → WIN → Play Again', () => {
    render(<App />)
    loginAndChoose('Green')
    fireEvent.click(screen.getByText('Start'))
    expect(window.location.pathname).toBe('/game')
    fireEvent.click(screen.getByText('WIN'))
    expect(window.location.pathname).toBe('/result/win')
    expect(screen.getByText('win Result')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Play Again'))
    expect(window.location.pathname).toBe('/bet')
  })

  it('connects RED → Bet → LOSS → Play Again', () => {
    render(<App />)
    loginAndChoose('Red')
    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('LOSS'))
    expect(window.location.pathname).toBe('/result/loss')
    expect(screen.getByText('loss Result')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Play Again'))
    expect(window.location.pathname).toBe('/bet')
  })

  it('opens Tournament and returns with the bet flow intact', () => {
    render(<App />)
    loginAndChoose('Green')
    fireEvent.click(screen.getByText('Tournament'))
    expect(window.location.pathname).toBe('/tournament')
    fireEvent.click(screen.getByText('Close Table'))
    expect(window.location.pathname).toBe('/bet')
    expect(screen.getByText('Bet Screen')).toBeInTheDocument()
  })

  it('opens Profile from authenticated screens and returns to the previous flow', () => {
    render(<App />)
    loginAndChoose('Green')
    fireEvent.click(screen.getByText('Bet Profile'))
    expect(window.location.pathname).toBe('/profile')
    expect(screen.getByText('Profile Screen')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Profile Back'))
    expect(window.location.pathname).toBe('/bet')

    fireEvent.click(screen.getByText('Start'))
    fireEvent.click(screen.getByText('WIN'))
    expect(screen.getByText('6 / 6')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Result Profile'))
    expect(window.location.pathname).toBe('/profile')
    expect(screen.getByText('6 / 6')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Profile Back'))
    expect(window.location.pathname).toBe('/result/win')
  })

  it('redirects a direct result route without a round to a safe screen', async () => {
    window.sessionStorage.setItem(MOCK_STATE_KEY, JSON.stringify({
      currentUser: { userId: 'demo', displayName: 'Demo', balance: 500, score: 0, lotteryTickets: 0 },
      selectedTheme: 'green',
    }))
    window.history.replaceState(null, '', '/result/win')
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/bet'))
  })

  it('logs out directly to login and does not restore mode with Back', async () => {
    render(<App />)
    loginAndChoose('Green')
    // Return to mode through the browser history, then exercise its logout action.
    window.history.pushState(null, '', '/mode')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await waitFor(() => expect(screen.getByText('Logout')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Logout'))
    expect(window.location.pathname).toBe('/login')
    expect(window.sessionStorage.getItem(MOCK_STATE_KEY)).toBeNull()
    expect(screen.queryByText('Landing Play')).not.toBeInTheDocument()
    window.history.back()
    expect(window.location.pathname).not.toBe('/mode')
  })
})

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
  default: ({ onModeSelected, onOpenRating }: any) => (
    <><button onClick={() => onModeSelected('GREEN')}>Green</button><button onClick={() => onModeSelected('RED')}>Red</button><button onClick={onOpenRating}>Rating</button></>
  ),
}))

vi.mock('../features/betting/pages/BetSelectionPage', () => ({
  BetSelectionPage: ({ onStart, onOpenTournament, onCloseTournament, tournamentOpen, ratingOpen }: any) => (
    <>
      <span>Bet Screen</span>
      <button onClick={() => onStart(15, 2)}>Start</button>
      <button onClick={onOpenTournament}>Tournament</button>
      {(tournamentOpen || ratingOpen) && <button onClick={onCloseTournament}>Close Table</button>}
    </>
  ),
}))

vi.mock('../features/game/MockGameplayBridge', () => ({
  MockGameplayBridge: ({ onWin, onLoss }: any) => <><button onClick={onWin}>WIN</button><button onClick={onLoss}>LOSS</button></>,
}))

vi.mock('../features/results', () => ({
  ResultScreen: ({ data, actions }: any) => <><span>{data.result} Result</span><button onClick={() => actions.onPlayAgain(data.theme)}>Play Again</button></>,
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

  it('redirects a direct result route without a round to a safe screen', async () => {
    window.sessionStorage.setItem(MOCK_STATE_KEY, JSON.stringify({
      currentUser: { userId: 'demo', displayName: 'Demo', balance: 500, score: 0, lotteryTickets: 0 },
      selectedTheme: 'green',
    }))
    window.history.replaceState(null, '', '/result/win')
    render(<App />)
    await waitFor(() => expect(window.location.pathname).toBe('/bet'))
  })
})

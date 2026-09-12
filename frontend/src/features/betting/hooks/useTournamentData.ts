import { useEffect, useMemo, useRef, useState } from 'react'
import { CURRENT_TOURNAMENT_PLAYER, TOURNAMENT_PARTICIPANTS } from '../mocks/tournamentParticipants'

const TOURNAMENT_DURATION_MS = (2 * 24 + 14) * 60 * 60 * 1000

function formatRemainingTime(milliseconds: number) {
  const totalHours = Math.max(0, Math.ceil(milliseconds / (60 * 60 * 1000)))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  return `${days} д ${hours} ч`
}

export function useTournamentData() {
  const deadlineRef = useRef(Date.now() + TOURNAMENT_DURATION_MS)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  return useMemo(() => ({
    currentPlayer: CURRENT_TOURNAMENT_PLAYER,
    description: 'Зарабатывай игровые очки и поднимайся выше в рейтинге. Проходи уровни, активируй бустеры и набирай очки!',
    isActive: true,
    otherParticipants: [...TOURNAMENT_PARTICIPANTS.slice(3), CURRENT_TOURNAMENT_PLAYER]
      .sort((left, right) => left.place - right.place),
    remainingTime: formatRemainingTime(deadlineRef.current - now),
    topThree: TOURNAMENT_PARTICIPANTS.slice(0, 3),
  }), [now])
}

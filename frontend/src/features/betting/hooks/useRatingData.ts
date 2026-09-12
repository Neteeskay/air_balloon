import { useMemo } from 'react'
import { CURRENT_RATING_PLAYER, RATING_PARTICIPANTS } from '../mocks/ratingParticipants'

export function useRatingData() {
  return useMemo(() => ({
    currentPlayer: CURRENT_RATING_PLAYER,
    description: 'Общий рейтинг игроков: сравнивай результаты, набирай очки и поднимайся выше каждый день.',
    otherParticipants: [...RATING_PARTICIPANTS.slice(3), CURRENT_RATING_PLAYER]
      .sort((left, right) => left.place - right.place),
    topThree: RATING_PARTICIPANTS.slice(0, 3),
  }), [])
}

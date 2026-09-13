import type { GlobalRating, GlobalRatingEntry } from '../../api/types'
import type { TournamentParticipant } from '../betting/types'

export type RatingViewData = {
  currentPlayer: TournamentParticipant
  description: string
  otherParticipants: TournamentParticipant[]
  topThree: TournamentParticipant[]
  totalParticipants: number
  revision: number
}

const AVATARS = ['🦊', '🐼', '🦁', '🐻', '🐨', '🐸', '🐰', '🐯', '🐹', '🐵', '🐶', '🐱', '🐺']

function stableHash(value: string) {
  return [...value].reduce((hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0, 7)
}

function toParticipant(entry: GlobalRatingEntry): TournamentParticipant {
  const hash = stableHash(`${entry.rank}:${entry.displayName}`)
  return {
    id: hash,
    place: entry.rank,
    name: entry.displayName,
    points: entry.score,
    avatar: AVATARS[hash % AVATARS.length],
    avatarHue: hash % 360,
    isCurrentPlayer: entry.currentPlayer,
  }
}

/** Adapt the server's privacy-safe global rating DTO to the existing visual rows. */
export function adaptGlobalRating(value: GlobalRating): RatingViewData {
  const entries = [...(value.entries ?? [])]
  if (!entries.some((entry) => entry.currentPlayer) && value.currentPlayer) entries.push(value.currentPlayer)
  const participants = entries.map(toParticipant).sort((left, right) => left.place - right.place)
  const currentPlayer = participants.find((entry) => entry.isCurrentPlayer)
    ?? toParticipant({ ...value.currentPlayer, currentPlayer: true })

  return {
    currentPlayer,
    description: 'Общий рейтинг игроков: сравнивай результаты, набирай очки и поднимайся выше каждый день.',
    otherParticipants: participants.filter((entry) => entry.place > 3),
    topThree: participants.filter((entry) => entry.place <= 3).slice(0, 3),
    totalParticipants: value.totalParticipants,
    revision: value.revision,
  }
}

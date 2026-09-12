export type Theme = 'green' | 'red'

export type BetOption = {
  id: number
  cost: number
  multiplier: 1 | 2 | 3 | 4
}

export type BetSelectionModal = 'rules' | 'tournament' | null

export type TournamentParticipant = {
  id: number
  place: number
  name: string
  points: number
  avatar: string
  avatarHue: number
  isCurrentPlayer?: boolean
  placeChange?: number
}

import type { TournamentParticipant } from '../types'

export const TOURNAMENT_PARTICIPANTS: TournamentParticipant[] = [
  { id: 1, place: 1, name: '***rina', points: 12450, avatar: '🐱', avatarHue: 38 },
  { id: 2, place: 2, name: '***exey', points: 11980, avatar: '🐱', avatarHue: 208 },
  { id: 3, place: 3, name: '***asha', points: 10760, avatar: '🐱', avatarHue: 342 },
  { id: 4, place: 4, name: '***ikita', points: 9840, avatar: '🐱', avatarHue: 218 },
  { id: 5, place: 5, name: '***ena', points: 9240, avatar: '🐱', avatarHue: 28 },
  { id: 6, place: 6, name: '***ax', points: 8910, avatar: '🐱', avatarHue: 204 },
  { id: 7, place: 7, name: '***lia', points: 8740, avatar: '🐱', avatarHue: 31 },
  { id: 8, place: 8, name: '***oma', points: 8680, avatar: '🐱', avatarHue: 221 },
  { id: 9, place: 9, name: '***art', points: 8530, avatar: '🐱', avatarHue: 8 },
  { id: 10, place: 10, name: '***ley', points: 8110, avatar: '🐱', avatarHue: 325 },
  { id: 11, place: 11, name: '***ira', points: 7890, avatar: '🐱', avatarHue: 43 },
  { id: 12, place: 12, name: '***nton', points: 7650, avatar: '🐱', avatarHue: 190 },
  { id: 13, place: 13, name: '***anna', points: 7420, avatar: '🐱', avatarHue: 292 },
  { id: 14, place: 14, name: '***eg', points: 7190, avatar: '🐱', avatarHue: 174 },
  { id: 15, place: 15, name: '***ila', points: 6830, avatar: '🐱', avatarHue: 15 },
  { id: 17, place: 17, name: '***ora', points: 6310, avatar: '🐱', avatarHue: 278 },
  { id: 18, place: 18, name: '***ark', points: 6080, avatar: '🐱', avatarHue: 121 },
  { id: 19, place: 19, name: '***ana', points: 5840, avatar: '🐱', avatarHue: 334 },
  { id: 20, place: 20, name: '***mir', points: 5590, avatar: '🐱', avatarHue: 192 },
  { id: 21, place: 21, name: '***eva', points: 5310, avatar: '🐱', avatarHue: 54 },
  { id: 22, place: 22, name: '***den', points: 5060, avatar: '🐱', avatarHue: 245 },
  { id: 23, place: 23, name: '***ina', points: 4810, avatar: '🐱', avatarHue: 308 },
  { id: 24, place: 24, name: '***oma', points: 4590, avatar: '🐱', avatarHue: 88 },
]

export const CURRENT_TOURNAMENT_PLAYER: TournamentParticipant = {
  id: 16,
  place: 16,
  name: 'SkyMira',
  points: 6540,
  avatar: '🐱',
  avatarHue: 206,
  isCurrentPlayer: true,
  placeChange: 2,
}

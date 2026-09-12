import type { TournamentParticipant } from '../types'

export const RATING_PARTICIPANTS: TournamentParticipant[] = [
  { id: 101, place: 1, name: '***lex', points: 28640, avatar: '🦊', avatarHue: 26 },
  { id: 102, place: 2, name: '***ira', points: 27320, avatar: '🐼', avatarHue: 198 },
  { id: 103, place: 3, name: '***max', points: 25910, avatar: '🦁', avatarHue: 45 },
  { id: 104, place: 4, name: '***lena', points: 24280, avatar: '🐻', avatarHue: 342 },
  { id: 105, place: 5, name: '***den', points: 22940, avatar: '🐨', avatarHue: 208 },
  { id: 106, place: 6, name: '***sasha', points: 21770, avatar: '🐸', avatarHue: 126 },
  { id: 107, place: 7, name: '***nna', points: 20460, avatar: '🐰', avatarHue: 315 },
  { id: 108, place: 8, name: '***pavel', points: 19640, avatar: '🐯', avatarHue: 31 },
  { id: 109, place: 9, name: '***kate', points: 18810, avatar: '🐹', avatarHue: 23 },
  { id: 110, place: 10, name: '***roma', points: 17960, avatar: '🐵', avatarHue: 52 },
  { id: 111, place: 11, name: '***yura', points: 17180, avatar: '🐶', avatarHue: 208 },
  { id: 112, place: 12, name: '***olga', points: 16520, avatar: '🐱', avatarHue: 280 },
  { id: 113, place: 13, name: '***igor', points: 15760, avatar: '🐺', avatarHue: 190 },
  { id: 114, place: 14, name: '***mila', points: 14920, avatar: '🐼', avatarHue: 100 },
  { id: 115, place: 15, name: '***mark', points: 14110, avatar: '🐻', avatarHue: 10 },
  { id: 117, place: 17, name: '***vera', points: 12620, avatar: '🐰', avatarHue: 330 },
  { id: 118, place: 18, name: '***oleg', points: 11790, avatar: '🦊', avatarHue: 17 },
  { id: 119, place: 19, name: '***rita', points: 10930, avatar: '🐨', avatarHue: 160 },
  { id: 120, place: 20, name: '***tim', points: 10240, avatar: '🐶', avatarHue: 215 },
  { id: 121, place: 21, name: '***liza', points: 9460, avatar: '🐹', avatarHue: 42 },
  { id: 122, place: 22, name: '***ilya', points: 8710, avatar: '🐯', avatarHue: 28 },
  { id: 123, place: 23, name: '***nina', points: 7940, avatar: '🐸', avatarHue: 118 },
  { id: 124, place: 24, name: '***sima', points: 7160, avatar: '🐵', avatarHue: 55 },
]

export const CURRENT_RATING_PLAYER: TournamentParticipant = {
  id: 116,
  place: 16,
  name: 'SkyMira',
  points: 13480,
  avatar: '🐱',
  avatarHue: 206,
  isCurrentPlayer: true,
  placeChange: 1,
}

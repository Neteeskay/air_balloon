import type { BetOption, Theme } from '../betting/types'

export type GameRoundSelection = {
  bet: number
  boosterMultiplier: BetOption['multiplier']
}

export type ActiveGameRound = GameRoundSelection & {
  roundId: string
  showCashoutHint: boolean
}

export type CrashGameFinish = {
  payout: number
}

export type GameSessionState = {
  balance: number
  round: ActiveGameRound | null
  soundOn: boolean
  theme: Theme
}

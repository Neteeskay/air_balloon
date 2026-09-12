export type GameTheme = 'red' | 'green';
export type RoundOutcome = 'win' | 'loss';

export interface RoundReward {
  count: number;
  label?: string;
  puzzleName?: string;
  collectedFragments?: number;
  totalFragments?: number;
  puzzleCompleted?: boolean;
  clothingReward?: {
    id: string;
    name: string;
  };
}

export interface ResultScreenData {
  roundId?: string;
  result: RoundOutcome;
  theme: GameTheme;
  betAmount: number;
  payoutAmount?: number;
  bonusBalance: number;
  cashoutMultiplier?: number;
  crashMultiplier: number;
  potentialMaxMultiplier?: number;
  earnedPoints: number;
  reward: RoundReward;
  playerName: string;
  canRepeatBet: boolean;
}

export interface ResultScreenActions {
  onPlayAgain: (theme: GameTheme) => void;
  onRepeatBet: (theme: GameTheme) => void | Promise<void>;
  onHome: () => void;
  onAutoReturn: (theme: GameTheme) => void;
  onMenu?: () => void;
  onProfile?: () => void;
}

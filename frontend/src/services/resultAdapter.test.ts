import { describe, expect, it } from 'vitest'
import { adaptRoundResult } from './resultAdapter'

const backendResult = {
  roundId: 'round-character-test',
  result: 'WIN',
  theme: 'GREEN',
  betAmount: 100,
  cashoutMultiplier: 5.9,
  crashMultiplier: 6,
  winAmount: 590,
  potentialWinAmount: 600,
  score: 350,
  balanceAfter: 1490,
  reward: {
    type: 'PUZZLE_FRAGMENT',
    puzzleId: 'clouds',
    puzzleName: 'Облачный путь',
    fragmentGranted: 1,
    fragments: 6,
    totalFragments: 12,
    puzzleCompleted: false,
  },
  playerCharacter: {
    code: 'CLOSE_CALL',
    title: 'На волоске — серверный текст',
    description: 'Сервер определил характер завершённого раунда.',
  },
  playerName: 'Пилот',
  canRepeatBet: true,
} as const

describe('adaptRoundResult', () => {
  it('preserves the backend playerCharacter without reclassification', () => {
    const adapted = adaptRoundResult(backendResult)

    expect(adapted.playerCharacter).toEqual(backendResult.playerCharacter)
    expect(adapted.earnedPoints).toBe(350)
    expect(adapted.reward).toMatchObject({
      count: 1,
      label: 'Облачный путь',
      collectedFragments: 6,
      totalFragments: 12,
      puzzleCompleted: false,
    })
  })

  it('keeps the result safe when playerCharacter is null', () => {
    const adapted = adaptRoundResult({ ...backendResult, playerCharacter: null })

    expect(adapted.playerCharacter).toBeUndefined()
  })
})

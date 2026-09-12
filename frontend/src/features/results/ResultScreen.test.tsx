import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ResultScreenActions, ResultScreenData } from '../../types/result'
import { ResultScreen } from './ResultScreen'

const actions: ResultScreenActions = {
  onPlayAgain: vi.fn(),
  onRepeatBet: vi.fn(),
  onHome: vi.fn(),
  onAutoReturn: vi.fn(),
}

const baseData: ResultScreenData = {
  roundId: 'round-result-test',
  result: 'loss',
  theme: 'red',
  betAmount: 50,
  bonusBalance: 450,
  crashMultiplier: 1.4,
  earnedPoints: 10,
  reward: {
    count: 0,
    label: 'Фрагмент не получен',
    collectedFragments: 5,
    totalFragments: 6,
  },
  playerName: 'Игрок',
  canRepeatBet: true,
}

describe('result puzzle reward', () => {
  it('shows an unearned fragment in the muted state with a zero round amount', () => {
    render(<ResultScreen actions={actions} autoReturnSeconds={30} data={baseData} />)

    const reward = screen.getByTestId('fragment-reward')
    expect(reward).toHaveClass('is-unearned')
    expect(reward).toHaveTextContent('×0')
    expect(reward).not.toHaveTextContent('5 / 6')
  })

  it('keeps the collected puzzle progress for an awarded fragment', () => {
    render(
      <ResultScreen
        actions={actions}
        autoReturnSeconds={30}
        data={{
          ...baseData,
          result: 'win',
          payoutAmount: 100,
          cashoutMultiplier: 2,
          reward: {
            ...baseData.reward,
            count: 1,
            label: 'Получен фрагмент',
            collectedFragments: 6,
          },
        }}
      />,
    )

    const reward = screen.getByTestId('fragment-reward')
    expect(reward).not.toHaveClass('is-unearned')
    expect(reward).toHaveTextContent('6 / 6')
  })
})

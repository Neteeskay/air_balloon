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

  it('renders the backend reward name without using Cloud Scarf artwork for another reward', () => {
    render(
      <ResultScreen
        actions={actions}
        autoReturnSeconds={30}
        data={{
          ...baseData,
          result: 'win',
          reward: {
            count: 1,
            label: 'Небесное путешествие',
            puzzleName: 'Небесное путешествие',
            collectedFragments: 6,
            totalFragments: 6,
            puzzleCompleted: true,
            clothingReward: { id: 'TRAVELER_COSTUME', name: 'Костюм путешественника' },
          },
        }}
      />,
    )

    const rewardImage = screen.getByRole('img', { name: 'Костюм путешественника' })
    expect(rewardImage).toHaveAttribute('src', expect.stringContaining('puzzle'))
    expect(screen.getByRole('status')).toHaveTextContent('Открыт новый предмет: Костюм путешественника')
  })
})

describe('player character', () => {
  const characters = [
    ['CAUTIOUS', 'Осторожный'],
    ['COLD_BLOODED', 'Хладнокровный'],
    ['CLOSE_CALL', 'На волоске'],
    ['BOOSTER_HUNTER', 'Охотник за бустером'],
    ['GREEDY', 'Жадина'],
    ['ADVENTURER', 'Искатель высоты'],
  ] as const

  it.each(characters)('renders backend character %s', (code, title) => {
    const description = `Описание от backend для ${code}`
    render(
      <ResultScreen
        actions={actions}
        autoReturnSeconds={30}
        data={{ ...baseData, playerCharacter: { code, title, description } }}
      />,
    )

    const character = screen.getByTestId('player-character')
    expect(character).toHaveTextContent('Характер этого полёта')
    expect(character).toHaveTextContent(title)
    expect(character).toHaveTextContent(description)
    expect(character).toHaveClass(`result-character--${code.toLowerCase().replaceAll('_', '-')}`)
  })

  it.each(['win', 'loss'] as const)('is visible for a %s result', result => {
    render(
      <ResultScreen
        actions={actions}
        autoReturnSeconds={30}
        data={{
          ...baseData,
          result,
          ...(result === 'win' ? { payoutAmount: 100, cashoutMultiplier: 2 } : {}),
          playerCharacter: {
            code: result === 'win' ? 'CLOSE_CALL' : 'GREEDY',
            title: `Backend ${result}`,
            description: `Backend description ${result}`,
          },
        }}
      />,
    )

    expect(screen.getByTestId('player-character')).toHaveTextContent(`Backend ${result}`)
  })

  it('does not render the block when backend omits playerCharacter', () => {
    render(<ResultScreen actions={actions} autoReturnSeconds={30} data={baseData} />)

    expect(screen.queryByTestId('player-character')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Играть снова' })).toBeInTheDocument()
  })

  it('renders backend-owned title and description verbatim', () => {
    render(
      <ResultScreen
        actions={actions}
        autoReturnSeconds={30}
        data={{
          ...baseData,
          playerCharacter: {
            code: 'CAUTIOUS',
            title: 'Точный заголовок сервера',
            description: 'Точное описание сервера без клиентской переклассификации.',
          },
        }}
      />,
    )

    expect(screen.getByText('Точный заголовок сервера')).toBeInTheDocument()
    expect(screen.getByText('Точное описание сервера без клиентской переклассификации.')).toBeInTheDocument()
  })
})

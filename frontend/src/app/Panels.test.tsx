import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { SESSION_KEY } from '../api/demoUsers'
import { MockBackend } from '../api/mock'
import type { Result } from '../api/types'
import { round } from '../test/helpers'
import { ResultScreen } from './Panels'

describe('result error states', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem(SESSION_KEY, 'anna') })

  it('stops loading after a failure and can retry the result request', async () => {
    const backend = new MockBackend(localStorage, () => Date.parse('2026-09-11T00:00:00Z'), false); let attempts = 0
    const result: Result = { roundId: 'round-1', result: 'LOSS', betAmount: 100, crashMultiplier: 1.96, winAmount: 0, potentialWinAmount: 196, score: 200, playerCharacter: { code: 'ADVENTURER', title: 'Искатель высоты', description: 'Каждый полёт — новый шанс подняться выше' }, reward: { type: 'CLOUD', rarity: 'COMMON' } }
    const api = { ...backend.api, game: { ...backend.api.game, getResult: async () => { attempts++; if (attempts === 1) throw new Error('Результат временно недоступен'); return result } } }
    render(<ResultScreen api={api} round={round('RED', { status: 'FINISHED', outcome: 'LOSS', crashMultiplier: 1.96, finishedAt: '2026-09-11T00:00:08Z' })} onAgain={() => {}} onHistory={() => {}} onFairness={() => {}} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Результат временно недоступен')
    expect(screen.getByText('Недоступно')).toBeInTheDocument()
    expect(screen.queryByText('Загружаем…')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('☁ Облачко · COMMON')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Характер полёта' })).toHaveTextContent('«Искатель высоты»')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    backend.dispose()
  })

  it.each([
    ['WIN', 'CLOSE_CALL', 'На волоске', 'Забрал выигрыш буквально перед Crash'],
    ['LOSS', 'GREEDY', 'Жадина', 'Рискнул подняться выше, но шар не выдержал'],
  ] as const)('shows the backend character on a %s result', async (outcome, code, title, description) => {
    const backend = new MockBackend(localStorage, () => Date.parse('2026-09-11T00:00:00Z'), false)
    const result: Result = { roundId: 'round-1', result: outcome, betAmount: 100, cashoutMultiplier: outcome === 'WIN' ? 5.9 : undefined, crashMultiplier: 6, winAmount: outcome === 'WIN' ? 590 : 0, score: 300, playerCharacter: { code, title, description } }
    const api = { ...backend.api, game: { ...backend.api.game, getResult: async () => result } }
    render(<ResultScreen api={api} round={round('RED', { status: 'FINISHED', cashoutPerformed: outcome === 'WIN', cashoutMultiplier: result.cashoutMultiplier, crashMultiplier: 6, finishedAt: '2026-09-11T00:00:08Z' })} onAgain={() => {}} onHistory={() => {}} onFairness={() => {}} />)
    const card = await screen.findByRole('region', { name: 'Характер полёта' })
    expect(card).toHaveTextContent(`«${title}»`); expect(card).toHaveTextContent(description)
    backend.dispose()
  })
})

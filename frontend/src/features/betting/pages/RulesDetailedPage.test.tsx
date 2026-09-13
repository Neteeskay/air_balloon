import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { Api, Catalog } from '../../../api/types'
import { RulesModal } from '../components/RulesModal'
import { RulesDetailedPage } from './RulesDetailedPage'

const catalog: Catalog = {
  boosters: [1, 2, 3, 4],
  cashoutPoints: 25,
  levels: { GREEN: 9, RED: 12 },
  pointsPerLevel: 75,
  stakeOptions: [
    { active: true, amount: 40, boosterMultiplier: 1 },
    { active: true, amount: 90, boosterMultiplier: 2 },
    { active: false, amount: 140, boosterMultiplier: 3 },
    { active: true, amount: 200, boosterMultiplier: 4 },
  ],
  stakeRules: { decimalPlaces: 0, maximum: 1000, minimum: 1 },
  stakes: [40, 90, 200],
}

const rulesApi = {
  mode: 'real',
  catalog: { get: vi.fn(async () => catalog) },
} as unknown as Api

const realCatalogWithoutScores = {
  ...catalog,
  pointsPerLevel: undefined,
  cashoutPoints: undefined,
}

const realRulesApi = {
  mode: 'real',
  catalog: { get: vi.fn(async () => realCatalogWithoutScores) },
} as unknown as Api

describe('RulesDetailedPage', () => {
  it('uses the active catalog and explains all implemented mechanics', async () => {
    render(<RulesDetailedPage api={rulesApi} onBack={() => undefined} theme="green" />)

    expect(await screen.findByText(/На зелёном маршруте 9 уровней, на красном — 12/)).toBeInTheDocument()
    const stakeSection = screen.getByRole('region', { name: 'Ставка и карточка-фрагмент' })
    expect(within(stakeSection).getByText('40')).toBeInTheDocument()
    expect(within(stakeSection).getByText('90')).toBeInTheDocument()
    expect(within(stakeSection).getByText('200')).toBeInTheDocument()
    expect(within(stakeSection).queryByText('140')).not.toBeInTheDocument()
    expect(screen.getByText('+75')).toBeInTheDocument()
    expect(screen.getByText('+25')).toBeInTheDocument()
    expect(screen.getByText('Каждый фрагмент занимает своё место в коллекции профиля.')).toBeInTheDocument()
    expect(screen.getByText(/монеты, одежда для шиншиллы или другой бонус/)).toBeInTheDocument()
  })

  it('returns through both the header action and Escape', () => {
    const onBack = vi.fn()
    render(<RulesDetailedPage api={rulesApi} onBack={onBack} theme="red" />)

    fireEvent.click(screen.getByRole('button', { name: 'Назад' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onBack).toHaveBeenCalledTimes(2)
  })

  it('does not present mutable real-server score values as fixed numbers', async () => {
    render(<RulesDetailedPage api={realRulesApi} onBack={() => undefined} theme="green" />)

    expect(await screen.findByText('за каждый пройденный')).toBeInTheDocument()
    expect(await screen.findByText('за удачный полёт')).toBeInTheDocument()
    expect(await screen.findByText('за сработавший бустер')).toBeInTheDocument()
    expect(screen.getByText(/Если вы вовремя забрали выигрыш и текущий пазл ещё не собран/)).toBeInTheDocument()
  })

  it('opens details from the existing short rules modal', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
    const onClose = vi.fn()
    const onOpenDetails = vi.fn()
    const view = render(<RulesModal onClose={onClose} onOpenDetails={onOpenDetails} />)

    fireEvent.click(screen.getByRole('button', { name: 'Подробнее' }))
    expect(onClose).toHaveBeenCalledOnce()
    expect(onOpenDetails).toHaveBeenCalledOnce()
    view.unmount()
    play.mockRestore()
    pause.mockRestore()
  })
})

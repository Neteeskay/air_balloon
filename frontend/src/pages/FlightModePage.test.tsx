import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import FlightModePage from './FlightModePage'

const currentUser = { userId: 'test-user', displayName: 'Пушок' }

function renderPage(onModeSelected = vi.fn()) {
  return {
    onModeSelected,
    ...render(
      <FlightModePage
        currentUser={currentUser}
        onLogout={vi.fn()}
        onModeSelected={onModeSelected}
        onOpenRating={vi.fn()}
        onProfile={vi.fn()}
      />,
    ),
  }
}

describe('FlightModePage onboarding and mode selection', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps a mode click inside onboarding and prompts for a game after completion', () => {
    const { onModeSelected } = renderPage()

    fireEvent.click(screen.getByRole('button', { name: /Выбрать зелёный шар/ }))
    expect(onModeSelected).not.toHaveBeenCalled()
    expect(screen.getByText('Привет! Я Шиншилот 🐭')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: /Пропустить обучение/ }))
    expect(screen.getByText('Выберите игру')).toBeVisible()
    expect(screen.getByRole('button', { name: /Выбрать зелёный шар/ })).toBeVisible()
  })

  it('allows GREEN and RED selection once onboarding is complete', () => {
    const onModeSelected = vi.fn()
    renderPage(onModeSelected)
    fireEvent.click(screen.getByRole('button', { name: /Пропустить обучение/ }))

    fireEvent.click(screen.getByRole('button', { name: /Выбрать зелёный шар/ }))
    fireEvent.click(screen.getByRole('button', { name: /Выбрать красный шар/ }))
    expect(onModeSelected.mock.calls.map(([mode]) => mode)).toEqual(['GREEN', 'RED'])
  })

  it('renders the source trophy asset on the rating card', () => {
    window.localStorage.setItem('air-balloon-flight-mode-onboarding-complete:test-user', 'true')
    renderPage()
    expect(document.querySelector('img[src="/assets/icons/кубок_старт.png"]')).toBeInTheDocument()
  })
})

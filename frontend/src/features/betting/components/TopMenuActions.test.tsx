import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TopMenuActions } from './TopMenuActions'

describe('top menu mobile navigation', () => {
  it('opens the burger panel with the shared navigation actions', () => {
    const onOpenTournament = vi.fn()
    const onOpenHistory = vi.fn()
    const onOpenRules = vi.fn()
    const onProfile = vi.fn()
    const { container } = render(
      <TopMenuActions
        onOpenHistory={onOpenHistory}
        onOpenRules={onOpenRules}
        onOpenTournament={onOpenTournament}
        onProfile={onProfile}
        onToggleSound={() => undefined}
        soundOn
      />,
    )

    const toggle = screen.getByRole('button', { name: 'Открыть меню' })
    fireEvent.click(toggle)
    const panel = container.querySelector('.top-menu-links')!
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(panel).toHaveClass('is-open')
    expect(screen.getByRole('button', { name: 'Открыть историю игр' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Профиль' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Открыть историю игр' }))
    expect(onOpenHistory).toHaveBeenCalledTimes(1)
    expect(panel).not.toHaveClass('is-open')

    fireEvent.click(screen.getByRole('button', { name: 'Открыть меню' }))
    fireEvent.pointerDown(document.body)
    expect(panel).not.toHaveClass('is-open')
  })
})

import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_KEY } from '../api/demoUsers'
import { MockBackend } from '../api/mock'
import App from './App'

describe('clickable application flow', () => {
  beforeEach(() => { localStorage.clear(); localStorage.setItem(SESSION_KEY, 'anna'); vi.useFakeTimers(); vi.setSystemTime('2026-09-11T00:00:00Z') })
  afterEach(() => vi.useRealTimers())
  it('preserves RED and its 12 levels after Play again', async () => {
    let now = Date.parse('2026-09-11T00:00:00Z')
    const backend = new MockBackend(localStorage, () => now, false)
    backend.api.dev!.setPreset('LOSE')
    render(<App api={backend.api} />)
    await act(async () => {})
    fireEvent.click(screen.getByRole('button', { name: /Red Balloon/i }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Начать полёт/i })); await Promise.resolve(); await Promise.resolve() })
    now += 8200
    await act(async () => { backend.tick(); await Promise.resolve() })
    await act(async () => { await vi.advanceTimersByTimeAsync(1400) })
    expect(screen.getByText(/чуть выше риска/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Играть снова/i }))
    expect(screen.getByRole('button', { name: /Red Balloon/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getAllByTestId('preview-level')).toHaveLength(12)
    backend.dispose()
  })
})

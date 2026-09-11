import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_KEY } from '../api/demoUsers'
import { MockBackend } from '../api/mock'
import App from './App'

describe('first-flight cashout onboarding', () => {
  beforeEach(() => {
    localStorage.clear(); localStorage.setItem(SESSION_KEY, 'anna')
    vi.useFakeTimers(); vi.setSystemTime('2026-09-11T00:00:00Z')
  })
  afterEach(() => vi.useRealTimers())

  it('is visible for approximately four seconds on the first real start', async () => {
    const backend = new MockBackend(localStorage, () => Date.now(), false)
    render(<App api={backend.api} />); await act(async () => {})
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Начать полёт/i })); await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('Забрать выигрыш можно после первого уровня')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(3999) })
    expect(screen.getByText('Забрать выигрыш можно после первого уровня')).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1) })
    expect(screen.queryByText('Забрать выигрыш можно после первого уровня')).not.toBeInTheDocument()
    backend.dispose()
  })

  it('cleans the onboarding timer when the game unmounts', async () => {
    const backend = new MockBackend(localStorage, () => Date.now(), false)
    const view = render(<App api={backend.api} />); await act(async () => {})
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Начать полёт/i })); await Promise.resolve(); await Promise.resolve() })
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    view.unmount()
    expect(clear).toHaveBeenCalled()
    backend.dispose()
  })

  it('does not repeat on the next round for the same profile', async () => {
    let now = Date.parse('2026-09-11T00:00:00Z')
    const backend = new MockBackend(localStorage, () => now, false); backend.api.dev!.setPreset('LOSE')
    render(<App api={backend.api} />); await act(async () => {})
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Начать полёт/i })); await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByText('Забрать выигрыш можно после первого уровня')).toBeInTheDocument()
    now += 8200
    await act(async () => { backend.tick(); await vi.advanceTimersByTimeAsync(4200) })
    expect(screen.getByTestId('round-result')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Играть снова/i }))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Начать полёт/i })); await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByText('Забрать выигрыш можно после первого уровня')).not.toBeInTheDocument()
    backend.dispose()
  })
})

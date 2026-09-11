import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_KEY } from '../api/demoUsers'
import { MockBackend, mockCatalog } from '../api/mock'
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
    expect(screen.getByRole('button', { name: /Начать полёт/i })).toBeEnabled()
    expect(screen.queryByText(/ПОЛЁТ ЗАВЕРШЁН/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Зафиксировано/i)).not.toBeInTheDocument()
    backend.dispose()
  })
  it('recovers from a transient catalog failure instead of leaving an endless loader', async () => {
    const now = Date.parse('2026-09-11T00:00:00Z'); let attempts = 0
    const backend = new MockBackend(localStorage, () => now, false)
    const api = { ...backend.api, catalog: { get: async () => { attempts++; if (attempts === 1) throw new Error('Временная ошибка каталога'); return backend.api.catalog.get() } } }
    render(<App api={api} />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByRole('alert')).toHaveTextContent('Временная ошибка каталога')
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем варианты полёта')
    fireEvent.click(screen.getByRole('button', { name: /Повторить чтение/i }))
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByRole('button', { name: /Начать полёт/i })).toBeEnabled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    backend.dispose()
  })
  it('shows loading while a delayed catalog request is pending and then renders setup', async () => {
    const now = Date.parse('2026-09-11T00:00:00Z'); let resolveCatalog!: (value: typeof mockCatalog) => void
    const backend = new MockBackend(localStorage, () => now, false); const delayedCatalog = new Promise<typeof mockCatalog>(resolve => { resolveCatalog = resolve })
    const api = { ...backend.api, catalog: { get: () => delayedCatalog } }
    render(<App api={api} />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.getByRole('status')).toHaveTextContent('Загружаем варианты полёта')
    await act(async () => { resolveCatalog(mockCatalog); await delayedCatalog })
    expect(screen.getByRole('button', { name: /Начать полёт/i })).toBeEnabled()
    backend.dispose()
  })
})

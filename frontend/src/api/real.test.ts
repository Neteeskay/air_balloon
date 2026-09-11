import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRealApi } from './real'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })
const state = { userId: '00000000-0000-0000-0000-000000000001', username: 'anna', displayName: 'Анна Ветрова', bonusBalance: 5000, gameScore: 700 }

afterEach(() => vi.unstubAllGlobals())

describe('real backend adapter', () => {
  it('uses server-session auth and canonical UUID identity', async () => {
    const fetch = vi.fn().mockResolvedValue(json(state)); vi.stubGlobal('fetch', fetch)
    const user = await createRealApi().auth.login(' anna ', 'balloon1')
    expect(user.id).toBe(state.userId)
    expect(fetch).toHaveBeenCalledWith('/api/auth/demo-login', expect.objectContaining({ credentials: 'include', method: 'POST' }))
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ username: 'anna', password: 'balloon1' })
  })

  it('maps the authoritative catalog without exposing hidden thresholds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ active: true, themes: [{ theme: 'GREEN', levels: 9, active: true }, { theme: 'RED', levels: 12, active: true }], stakes: { minimum: 1, maximum: 1000, decimalPlaces: 0 }, boosters: [1, 2, 3, 4].map(multiplier => ({ multiplier, active: true })) })))
    const catalog = await createRealApi().catalog.get()
    expect(catalog.levels).toEqual({ GREEN: 9, RED: 12 }); expect(catalog.stakeRules).toEqual({ minimum: 1, maximum: 1000, decimalPlaces: 0 }); expect(catalog.boosters).toEqual([1, 2, 3, 4])
  })

  it('reads principal-scoped balance, score and personal history', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(json({ bonusBalance: 4321, serverTime: '2026-09-11T00:00:00Z' }))
      .mockResolvedValueOnce(json({ ...state, bonusBalance: 4321 }))
      .mockResolvedValueOnce(json({ items: [], page: 0, size: 20, total: 0 }))
    vi.stubGlobal('fetch', fetch); const api = createRealApi()
    await expect(api.economy.getBalance()).resolves.toEqual({ bonusBalance: 4321, gameScore: 700 })
    await api.history.getHistory()
    expect(fetch.mock.calls.map(call => call[0])).toEqual(['/api/current-user/balance', '/api/current-user/state', '/api/current-user/history?page=0&size=20'])
  })

  it('notifies the app on an expired authenticated request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(json({ code: 'AUTH_REQUIRED', message: 'raw backend message' }, 401))))
    const api = createRealApi(); const listener = vi.fn(); api.auth.onRequired!(listener)
    await expect(api.economy.getBalance()).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' })
    expect(listener).toHaveBeenCalled()
  })

  it('independently verifies the canonical SHA-256 fairness proof', async () => {
    const canonicalInput = 'air-balloon-fairness:v1\nroundId=00000000-0000-0000-0000-000000000123\nserverSeed=42\ncrashMultiplier=8.42\nboosterLevel=3\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ roundId: '00000000-0000-0000-0000-000000000123', status: 'REVEALED', commitment: 'sha256:fb553c3b8fce90e8b7b024d5917254fb402b22b343ebf2cf96209cb8f6008456', serverSeed: '42', crashMultiplier: 8.42, boosterLevel: 3, canonicalInput })))
    await expect(createRealApi().game.getFairness('00000000-0000-0000-0000-000000000123')).resolves.toEqual(expect.objectContaining({ verified: true }))
  })
})

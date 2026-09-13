import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminApiError, AdminClient, adminSession, clearAdminSession } from './client'

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { localStorage.clear(); clearAdminSession() })
afterEach(() => vi.unstubAllGlobals())

describe('admin client', () => {
  it('logs in with credentials and persists the bearer session', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ accessToken: 'token-1', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z' }))
    vi.stubGlobal('fetch', fetch)
    const client = new AdminClient()
    await client.login({ username: 'admin', password: 'secret' })
    expect(fetch).toHaveBeenCalledWith('/api/admin/auth/login', expect.objectContaining({ method: 'POST' }))
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ username: 'admin', password: 'secret' })
    expect(adminSession()?.accessToken).toBe('token-1')
  })

  it('sends the bearer token and hits the review endpoints', async () => {
    localStorage.setItem('air-balloon-admin-session', JSON.stringify({ accessToken: 'token-1', expiresAt: '2099-01-01T00:00:00Z' }))
    const fetch = vi.fn().mockResolvedValue(json({ id: 'id-1', revision: 1, status: 'ACTIVE' }))
    vi.stubGlobal('fetch', fetch)
    const client = new AdminClient()
    await client.getCurrent()
    expect(fetch).toHaveBeenCalledWith('/api/admin/config/current', expect.objectContaining({ headers: { Authorization: 'Bearer token-1' } }))
  })

  it('exposes currentVersion on a 409 conflict', async () => {
    const fetch = vi.fn().mockResolvedValue(json({ code: 'CONFIG_VERSION_CONFLICT', message: 'Version mismatch', status: 409, currentVersion: 4 }, 409))
    vi.stubGlobal('fetch', fetch)
    const client = new AdminClient()
    const error = await client.createDraft({ gameId: 'air-balloon', gameName: 'x', gameType: 'CRASH', isActive: true, revision: 3, crash: { alpha: 0.85, maxMultiplier: 100, minCrashMultiplier: 1, multiplierGrowthRate: 0.15, fps: 60, delta: 0.0166666667 }, boosters: { multiplierTier1Value: 1, multiplierTier2Value: 2, multiplierTier3Value: 3, multiplierTier4Value: 4, green: { line1LootProb: 100 }, red: { line1LootProb: 100 } }, points: { pointsPerLine: 50, pointsCashoutBonus: 25, pointsXNBonus: 50 } }).catch(e => e)
    expect(error).toBeInstanceOf(AdminApiError)
    if (error instanceof AdminApiError) {
      expect(error.status).toBe(409)
      expect(error.code).toBe('CONFIG_VERSION_CONFLICT')
      expect(error.currentVersion).toBe(4)
      expect(error.message).toContain('Version mismatch')
    }
  })

  it('clears a stale session on 401', async () => {
    localStorage.setItem('air-balloon-admin-session', JSON.stringify({ accessToken: 'stale', expiresAt: '2099-01-01T00:00:00Z' }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ code: 'ADMIN_AUTH_REQUIRED', message: 'expired', status: 401 }, 401)))
    const client = new AdminClient()
    await expect(client.versions()).rejects.toMatchObject({ status: 401 })
    expect(adminSession()).toBeNull()
  })

  it('ignores an expired stored session', () => {
    localStorage.setItem('air-balloon-admin-session', JSON.stringify({ accessToken: 'old', expiresAt: '2000-01-01T00:00:00Z' }))
    expect(adminSession()).toBeNull()
  })

  it('imports a config file sending the raw content', async () => {
    localStorage.setItem('air-balloon-admin-session', JSON.stringify({ accessToken: 'token-1', expiresAt: '2099-01-01T00:00:00Z' }))
    const fetch = vi.fn().mockResolvedValue(json({ id: 'id-9', revision: 7, status: 'ACTIVE', points: { pointsPerLine: 777 } }))
    vi.stubGlobal('fetch', fetch)
    const client = new AdminClient()
    const result = await client.importFile('yaml', 'gameId: air-balloon')
    expect(result.revision).toBe(7)
    expect(fetch).toHaveBeenCalledWith('/api/admin/config/import?format=yaml', expect.objectContaining({
      method: 'POST',
      body: 'gameId: air-balloon',
      headers: { 'Content-Type': 'application/yaml', Authorization: 'Bearer token-1' },
    }))
  })

  it('downloads the exported config file with the server filename', async () => {
    localStorage.setItem('air-balloon-admin-session', JSON.stringify({ accessToken: 'token-1', expiresAt: '2099-01-01T00:00:00Z' }))
    const response = {
      ok: true,
      status: 200,
      headers: { get: (name: string) => name === 'Content-Disposition' ? 'attachment; filename="air-balloon-config-air-balloon.yaml"' : 'application/json' },
      blob: vi.fn().mockResolvedValue(new Blob(['{"gameId":"air-balloon"}'], { type: 'application/json' })),
    }
    const fetch = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetch)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const anchor = document.createElement('a')
    const clickSpy = vi.spyOn(anchor, 'click').mockImplementation(() => {})
    const removeSpy = vi.spyOn(anchor, 'remove').mockImplementation(() => {})
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    const client = new AdminClient()
    await client.exportFile('yaml')
    expect(fetch).toHaveBeenCalledWith('/api/admin/config/export?format=yaml', expect.objectContaining({ method: 'GET' }))
    expect(anchor.download).toBe('air-balloon-config-air-balloon.yaml')
    expect(anchor.href).toBe('blob:mock')
    expect(clickSpy).toHaveBeenCalled()
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalled()
    removeSpy.mockRestore()
    clickSpy.mockRestore()
    createElementSpy.mockRestore()
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
  })
})
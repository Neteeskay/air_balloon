import type {
  AdminErrorBody, AuditEvent, ConfigDiff, ConfigMetadata, ConfigurationVersionSummary,
  FieldViolation, GameConfiguration, GameConfigurationWrite, LoginRequest, LoginResponse,
  PageResponse, ValidationResult,
} from './types'

const SESSION_KEY = 'air-balloon-admin-session'
const base = () => import.meta.env.VITE_API_BASE_URL ?? ''

export interface AdminSession { accessToken: string; expiresAt: string }

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public traceId?: string,
    public fieldErrors?: FieldViolation[],
    public currentVersion?: number,
  ) { super(message); this.name = 'AdminApiError' }
}

export function adminSession(): AdminSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as AdminSession
    if (!session.accessToken || new Date(session.expiresAt).getTime() <= Date.now()) return null
    return session
  } catch { return null }
}

export function clearAdminSession() { localStorage.removeItem(SESSION_KEY) }

const messageFor = (status: number, body: AdminErrorBody | null) => {
  if (body?.message) return body.message
  if (status === 401) return 'Неверный логин или пароль администратора.'
  if (status === 403) return 'Доступ запрещён.'
  if (status === 409) return 'Конфигурация изменилась. Обновите данные и попробуйте снова.'
  if (status === 400) return 'Неверный запрос. Проверьте значения полей.'
  if (status === 404) return 'Данные не найдены.'
  return `Сервер вернул ошибку (${status}).`
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const session = adminSession()
  if (session) headers['Authorization'] = `Bearer ${session.accessToken}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${base()}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (response.status === 204) return undefined as T
  const text = await response.text()
  let payload: AdminErrorBody | null
  try { payload = text ? JSON.parse(text) as AdminErrorBody : null } catch { payload = null }
  if (!response.ok) {
    if (response.status === 401) clearAdminSession()
    throw new AdminApiError(response.status, payload?.code ?? 'HTTP_ERROR', messageFor(response.status, payload),
      payload?.traceId, payload?.fieldErrors, payload?.currentVersion)
  }
  return payload as unknown as T
}

async function requestFile(path: string, contentType: string, body: string): Promise<{ text: string; disposition: string | null }> {
  const headers: Record<string, string> = { 'Content-Type': contentType }
  const session = adminSession()
  if (session) headers['Authorization'] = `Bearer ${session.accessToken}`
  const response = await fetch(`${base()}${path}`, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(15000),
  })
  const text = await response.text()
  if (!response.ok) {
    let payload: AdminErrorBody | null
    try { payload = text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) as AdminErrorBody : null } catch { payload = null }
    if (response.status === 401) clearAdminSession()
    throw new AdminApiError(response.status, payload?.code ?? 'HTTP_ERROR', messageFor(response.status, payload),
      payload?.traceId, payload?.fieldErrors, payload?.currentVersion)
  }
  return { text, disposition: response.headers.get('Content-Disposition') }
}

export class AdminClient {
  async login(input: LoginRequest): Promise<AdminSession> {
    const response = await request<LoginResponse>('POST', '/api/admin/auth/login', input)
    const session = { accessToken: response.accessToken, expiresAt: response.expiresAt }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  }
  logout() { return request<void>('POST', '/api/admin/auth/logout') }
  getCurrent() { return request<GameConfiguration>('GET', '/api/admin/config/current') }
  getMetadata() { return request<ConfigMetadata>('GET', '/api/admin/config/metadata') }
  validate(body: GameConfigurationWrite) { return request<ValidationResult>('POST', '/api/admin/config/validate', body) }
  createDraft(body: GameConfigurationWrite) { return request<GameConfiguration>('POST', '/api/admin/config', body) }
  activate(id: string) { return request<GameConfiguration>('POST', `/api/admin/config/${encodeURIComponent(id)}/activate`) }
  versions(page = 0, size = 50) { return request<PageResponse<ConfigurationVersionSummary>>('GET', `/api/admin/config/versions?page=${page}&size=${size}`) }
  version(id: string) { return request<GameConfiguration>('GET', `/api/admin/config/versions/${encodeURIComponent(id)}`) }
  diff(fromId: string, toId: string) { return request<ConfigDiff>('GET', `/api/admin/config/versions/${encodeURIComponent(fromId)}/diff/${encodeURIComponent(toId)}`) }
  rollback(id: string) { return request<GameConfiguration>('POST', `/api/admin/config/versions/${encodeURIComponent(id)}/rollback`) }

  async exportFile(format: 'json' | 'yaml', versionId?: string): Promise<void> {
    const query = new URLSearchParams({ format })
    if (versionId) query.set('version', versionId)
    const headers: Record<string, string> = {}
    const session = adminSession()
    if (session) headers['Authorization'] = `Bearer ${session.accessToken}`
    const response = await fetch(`${base()}/api/admin/config/export?${query.toString()}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      let payload: AdminErrorBody | null = null
      try { payload = await response.json() as AdminErrorBody } catch { /* ignore */ }
      if (response.status === 401) clearAdminSession()
      throw new AdminApiError(response.status, payload?.code ?? 'HTTP_ERROR', messageFor(response.status, payload),
        payload?.traceId, payload?.fieldErrors, payload?.currentVersion)
    }
    const blob = await response.blob()
    const disposition = response.headers.get('Content-Disposition') ?? ''
    const match = /filename="?([^";]+)"?/.exec(disposition)
    const filename = match?.[1] ?? `air-balloon-config.${format}`
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async importFile(format: 'json' | 'yaml', content: string): Promise<GameConfiguration> {
    const contentType = format === 'json' ? 'application/json' : 'application/yaml'
    const { text } = await requestFile(`/api/admin/config/import?format=${format}`, contentType, content)
    return JSON.parse(text) as GameConfiguration
  }
  audit(params: { action?: string; administrator?: string; version?: string; from?: string; to?: string; page?: number; size?: number } = {}) {
    const query = new URLSearchParams()
    if (params.action) query.set('action', params.action)
    if (params.administrator) query.set('administrator', params.administrator)
    if (params.version) query.set('version', params.version)
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    query.set('page', String(params.page ?? 0))
    query.set('size', String(params.size ?? 50))
    return request<PageResponse<AuditEvent>>('GET', `/api/admin/audit?${query.toString()}`)
  }
}

export const adminClient = new AdminClient()
import type { Api, Fairness, GameEvent, TournamentUpdate, User } from './types'
import { calculateCrash, verifyCommitment } from '../fairness/verifier'

type ErrorBody = { code?: string; message?: string }
type UserState = { userId: string; username: string; displayName: string; bonusBalance: number; gameScore: number }
type CatalogDto = {
  active: boolean
  themes: { theme: 'GREEN' | 'RED'; levels: number; active: boolean }[]
  stakes: { minimum: number; maximum: number; decimalPlaces: number }
  boosters: { multiplier: number; active: boolean }[]
}
type GlobalHistoryPageDto = { items: Array<Record<string, unknown> & { roundScore: number; finishedAt: string }>; page: number; size: number; total: number }

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'ApiError' }
}

const errorMessage = (status: number, body: ErrorBody) => {
  if (status === 401) return body.code === 'AUTH_REQUIRED' ? 'Сессия истекла. Войдите снова.' : 'Проверьте логин и пароль.'
  if (status === 403) return 'У вас нет доступа к этим данным.'
  if (status === 400) return body.message || 'Проверьте выбранные параметры.'
  if (status === 409) return body.message || 'Состояние игры изменилось. Обновляем данные с сервера.'
  if (status === 503) return 'Игровой сервер временно недоступен. Попробуйте ещё раз.'
  return body.message || `API недоступен (${status}). Попробуйте восстановить состояние.`
}

const user = (state: UserState): User => {
  const initials = state.displayName.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()
  const colors = ['#fb5c55', '#4a9bff', '#58bf83', '#9b6df2']
  const hash = [...state.userId].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return { id: state.userId, name: state.displayName, login: state.username, initials: initials || state.username.slice(0, 2).toUpperCase(), color: colors[hash % colors.length] }
}

const stakeOptions = ({ minimum, maximum, decimalPlaces }: CatalogDto['stakes']) => {
  const step = 10 ** -decimalPlaces
  const rounded = (value: number) => Math.max(minimum, Math.min(maximum, Math.round(value / step) * step))
  const values = [...new Set([maximum * .1, maximum * .25, maximum * .5, maximum].map(rounded))].sort((a, b) => a - b)
  if (values.length !== 4) throw new Error('Каталог не позволяет показать ровно четыре связанных варианта ставки и бустера.')
  return values
}

export function createRealApi(base = ''): Api {
  const authListeners = new Set<() => void>()
  async function request<T>(path: string, init?: RequestInit, notifyAuth = true): Promise<T> {
    const response = await fetch(`${base}${path}`, { credentials: 'include', signal: AbortSignal.timeout(10000), ...init })
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as ErrorBody
      if (response.status === 401 && notifyAuth) authListeners.forEach(listener => listener())
      throw new ApiError(response.status, body.code ?? 'HTTP_ERROR', errorMessage(response.status, body))
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
  const roundPath = (id: string) => `/api/rounds/${encodeURIComponent(id)}`
  const wsUrl = (path: string) => { const url = new URL(path, base || location.href); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; return url }
  return {
    mode: 'real',
    auth: {
      demos: [],
      currentUser: async () => {
        try { return user(await request<UserState>('/api/auth/me', undefined, false)) }
        catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error }
      },
      login: async (login, password) => user(await request<UserState>('/api/auth/demo-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: login.trim(), password }),
      }, false)),
      logout: () => request<void>('/api/auth/session', { method: 'DELETE' }, false),
      onRequired: listener => { authListeners.add(listener); return () => authListeners.delete(listener) },
    },
    catalog: { get: async () => {
      const dto = await request<CatalogDto>('/api/game/catalog')
      const levels = { GREEN: 0, RED: 0 }
      dto.themes.filter(item => item.active).forEach(item => { levels[item.theme] = item.levels })
      if (!dto.active || !levels.GREEN || !levels.RED) throw new Error('Активный игровой каталог недоступен.')
      return { stakes: stakeOptions(dto.stakes), stakeRules: dto.stakes, boosters: dto.boosters.filter(item => item.active).map(item => item.multiplier), levels }
    } },
    economy: { getBalance: async () => {
      const [balance, state] = await Promise.all([
        request<{ bonusBalance: number }>('/api/current-user/balance'),
        request<UserState>('/api/current-user/state'),
      ])
      return { bonusBalance: balance.bonusBalance, gameScore: state.gameScore }
    } },
    history: {
      getGlobalHistory: async page => {
        const value = await request<GlobalHistoryPageDto>(`/api/history?page=${page ?? 0}&size=20`)
        return { ...value, items: value.items.map(({ roundScore, finishedAt, ...item }) => ({ ...item, score: roundScore, completedAt: finishedAt })) } as never
      },
      getPersonalHistory: page => request(`/api/current-user/history?page=${page ?? 0}&size=20`),
    },
    game: {
      startRound: (input, idempotencyKey) => request('/api/rounds', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) }, body: JSON.stringify(input) }),
      cashout: (id, key) => request(`${roundPath(id)}/cashout`, { method: 'POST', headers: { 'Idempotency-Key': key } }),
      getSnapshot: id => request(roundPath(id)),
      getReplay: (id, after) => request(`${roundPath(id)}/events?afterSequence=${after}`),
      getFairness: async id => { const proof = await request<Fairness>(`${roundPath(id)}/fairness`); const calculated = calculateCrash(proof); return { ...proof, verified: await verifyCommitment(proof), formulaVerified: calculated !== undefined && proof.crashMultiplier !== undefined ? Math.abs(calculated - proof.crashMultiplier) < 0.0000001 : undefined } },
      getResult: id => request(`${roundPath(id)}/result`),
      connect: (event, connection) => new Promise((resolve, reject) => {
        let socket: WebSocket; let stopped = false; let initiallyReady = false; let retries = 0
        let retry: ReturnType<typeof setTimeout>; let handshake: ReturnType<typeof setTimeout>
        const close = () => { stopped = true; clearTimeout(retry); clearTimeout(handshake); socket?.close() }
        const open = () => {
          if (stopped) return
          connection('connecting'); socket = new WebSocket(wsUrl('/ws/rounds'))
          handshake = setTimeout(() => { socket.close(); if (!initiallyReady) reject(new Error('Не удалось подключиться к игровому серверу.')) }, 8000)
          socket.onmessage = message => {
            try {
              const data = JSON.parse(String(message.data))
              if (data.type === 'CONNECTION_READY') {
                clearTimeout(handshake); retries = 0; connection('connected')
                if (!initiallyReady) { initiallyReady = true; resolve(close) }
              } else if (typeof data.roundId === 'string' && Number.isSafeInteger(data.sequence) && typeof data.eventId === 'string') event(data as GameEvent)
            } catch { connection('recovering') }
          }
          socket.onclose = () => { clearTimeout(handshake); if (stopped) return; connection('disconnected'); retry = setTimeout(open, Math.min(1000 * 2 ** retries++, 8000)) }
          socket.onerror = () => socket.close()
        }
        open()
      }),
    },
    tournament: {
      getActive: () => request('/api/tournaments/active'),
      getLeaderboard: id => request(`/api/tournaments/${encodeURIComponent(id)}/leaderboard?page=0&size=50`),
      join: id => request<void>(`/api/tournaments/${encodeURIComponent(id)}/participants/me`, { method: 'POST' }),
      connect: (id, update, connection) => new Promise((resolve, reject) => {
        let socket: WebSocket; let stopped = false; let initiallyReady = false; let retries = 0; let incoming = ''
        let retry: ReturnType<typeof setTimeout>; let handshake: ReturnType<typeof setTimeout>
        const send = (value: string) => socket.send(value.replace(/\n/g, '\r\n') + '\0')
        const close = () => { stopped = true; clearTimeout(retry); clearTimeout(handshake); socket?.close() }
        const handleFrame = (raw: string) => {
          const normalized = raw.replace(/^\s+/, '').replace(/\r/g, '')
          const split = normalized.indexOf('\n\n'); if (split < 0) return
          const command = normalized.slice(0, normalized.indexOf('\n'))
          const body = normalized.slice(split + 2)
          if (command === 'CONNECTED') {
            clearTimeout(handshake); retries = 0; connection('connected')
            send(`SUBSCRIBE\nid:leaderboard-${id}\ndestination:/topic/tournaments/${id}/leaderboard\nack:auto\n\n`)
            if (!initiallyReady) { initiallyReady = true; resolve(close) }
          } else if (command === 'MESSAGE') {
            try { update(JSON.parse(body) as TournamentUpdate) } catch { connection('recovering') }
          } else if (command === 'ERROR') socket.close()
        }
        const open = () => {
          if (stopped) return
          connection('connecting'); incoming = ''; socket = new WebSocket(wsUrl('/ws'), ['v12.stomp'])
          handshake = setTimeout(() => { socket.close(); if (!initiallyReady) reject(new Error('Не удалось подключиться к турниру.')) }, 8000)
          socket.onopen = () => send(`CONNECT\naccept-version:1.2\nhost:${location.host}\nheart-beat:10000,10000\n\n`)
          socket.onmessage = message => { incoming += String(message.data); const frames = incoming.split('\0'); incoming = frames.pop() ?? ''; frames.forEach(handleFrame) }
          socket.onclose = () => { clearTimeout(handshake); if (stopped) return; connection('disconnected'); retry = setTimeout(open, Math.min(1000 * 2 ** retries++, 8000)) }
          socket.onerror = () => socket.close()
        }
        open()
      }),
    },
    rating: {
      get: (page = 0, size = 50) => request(`/api/rating?page=${page}&size=${size}`),
    },
  }
}

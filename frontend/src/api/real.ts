import type { Api, GameEvent, HistoryPage } from './types'

export function createRealApi(base = ''): Api {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${base}${path}`, { credentials: 'include', signal: AbortSignal.timeout(10000), ...init })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body.message || `API недоступен (${response.status}). Попробуйте восстановить состояние.`)
    }
    return response.json()
  }
  const path = (id: string) => `/api/rounds/${encodeURIComponent(id)}`
  const waiting = async (): Promise<never> => { throw new Error('WAITING FOR CORE: серверный вход и каталог ставок ещё не согласованы. Используйте VITE_API_MODE=mock для демо.') }
  return {
    mode: 'real',
    // Do not send local demo credentials as a fake principal. Wire up the agreed
    // server auth/session here after CORE integration, keeping the UI unchanged.
    auth: { demos: [], currentUser: async () => null, login: waiting, logout: async () => {} },
    catalog: { get: waiting },
    economy: { getBalance: id => request(`/api/users/${encodeURIComponent(id)}/state`) },
    history: { getHistory: async (page = 0) => {
      const data = await request<HistoryPage>(`/api/history?page=${page}&size=10`)
      return data
    } },
    game: {
      // Start is not idempotent. Never automatically retry a failed POST.
      startRound: input => request('/api/rounds', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
      cashout: (id, key) => request(`${path(id)}/cashout`, { method: 'POST', headers: { 'Idempotency-Key': key } }),
      getSnapshot: id => request(path(id)),
      getReplay: (id, after) => request(`${path(id)}/events?afterSequence=${after}`),
      getFairness: id => request(`${path(id)}/fairness`),
      getResult: id => request(`${path(id)}/result`),
      connect: (event, connection) => new Promise((resolve, reject) => {
        let socket: WebSocket; let stopped = false; let ready = false; let retries = 0
        let retry: ReturnType<typeof setTimeout>; let handshake: ReturnType<typeof setTimeout>
        const close = () => { stopped = true; clearTimeout(retry); clearTimeout(handshake); socket?.close() }
        const open = () => {
          if (stopped) return
          connection('connecting')
          const url = new URL('/ws/rounds', base || location.href); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
          socket = new WebSocket(url)
          handshake = setTimeout(() => { if (!ready) { close(); reject(new Error('Не удалось подключиться к игровому серверу.')) } else socket.close() }, 8000)
          socket.onmessage = message => {
            try {
              const data = JSON.parse(message.data)
              if (data.type === 'CONNECTION_READY') {
                clearTimeout(handshake); retries = 0; connection('connected')
                if (!ready) { ready = true; resolve(close) }
              } else if (typeof data.roundId === 'string' && Number.isSafeInteger(data.sequence) && typeof data.eventId === 'string') event(data as GameEvent)
            } catch { connection('recovering') }
          }
          socket.onclose = () => { clearTimeout(handshake); if (stopped) return; connection('disconnected'); retry = setTimeout(open, Math.min(1000 * 2 ** retries++, 8000)) }
          socket.onerror = () => socket.close()
        }
        open()
      }),
    },
  }
}

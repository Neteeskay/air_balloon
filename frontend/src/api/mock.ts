import { demoUsers, SESSION_KEY } from './demoUsers'
import type { Api, Catalog, Connection, Fairness, GameEvent, HistoryItem, Preset, Round, StartInput, Wallet } from './types'

export const mockCatalog: Catalog = {
  stakes: [100, 250, 500, 1000], boosters: [1, 2, 3, 4], pointsPerLevel: 100, cashoutPoints: 50,
  thresholds: { GREEN: [1.2, 1.5, 2, 3, 4, 6, 8, 10, 12], RED: [1.2, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20] },
}
type StoredRound = { view: Round; owner: string; preset: Preset; processed: number; events: GameEvent[] }
type Database = { version: 1; wallets: Record<string, Wallet>; rounds: Record<string, StoredRound>; counter: number }
const DATA_KEY = 'air-balloon-game-mock-v1'
const clone = <T,>(value: T): T => structuredClone(value)
const initial = (): Database => ({ version: 1, wallets: Object.fromEntries(demoUsers.map(u => [u.id, { bonusBalance: 5000, gameScore: 0 }])), rounds: {}, counter: 0 })

/** UI-only deterministic simulator. Never imported/used to decide a REAL game result. */
export class MockBackend {
  private db: Database
  private preset: Preset = 'WIN'
  private online = true
  private listeners = new Set<{ event: (e: GameEvent) => void; connection: (s: Connection) => void }>()
  private timer?: ReturnType<typeof setInterval>
  private reconnectTimer?: ReturnType<typeof setTimeout>
  constructor(private storage: Storage, private now = () => Date.now(), private autoTick = true) {
    const saved = storage.getItem(DATA_KEY)
    try { const parsed = saved ? JSON.parse(saved) : null; this.db = parsed?.version === 1 ? parsed : initial() }
    catch { this.db = initial() }
  }
  private save() { this.storage.setItem(DATA_KEY, JSON.stringify(this.db)) }
  private ensureTimer() { if (this.autoTick && !this.timer) this.timer = setInterval(this.tick, 100) }
  private user() { const id = this.storage.getItem(SESSION_KEY); if (!id || !this.db.wallets[id]) throw new Error('Войдите в тестовый профиль.'); return id }
  private owned(id: string) { const r = this.db.rounds[id]; if (!r || r.owner !== this.user()) throw new Error('Раунд не найден для этого профиля.'); return r }
  private requireOnline() { if (!this.online) throw new Error('Соединение потеряно. Восстанавливаем состояние…') }
  private publicRound(r: StoredRound) { return clone(r.view) }
  private emit(r: StoredRound, type: string, data: Record<string, unknown>) {
    const v = r.view; v.sequence++; v.timestamp = new Date(this.now()).toISOString(); v.serverTime = v.timestamp
    const e: GameEvent = { type, roundId: v.id, sequence: v.sequence, eventId: `${v.id}:${v.sequence}`, timestamp: v.timestamp, serverTime: v.serverTime, data: clone(data) }
    if (type === 'ROUND_STARTED' || type === 'ROUND_FINISHED') e.data.round = clone(v)
    r.events.push(e); r.events = r.events.slice(-256)
    if (this.online) this.listeners.forEach(l => l.event(clone(e)))
  }
  private award(r: StoredRound, points: number) { r.view.roundScore += points; this.db.wallets[r.owner].gameScore += points }
  // Mock economy alone owns debit/credit. Components never mutate a wallet.
  private debit(owner: string, amount: number) {
    const w = this.db.wallets[owner]; if (w.bonusBalance < amount) throw new Error('Недостаточно бонусов для этой ставки.')
    w.bonusBalance -= amount
  }
  private credit(owner: string, amount: number) { this.db.wallets[owner].bonusBalance += amount }
  private proof(r: StoredRound): Fairness {
    const v = r.view
    return { roundId: v.id, status: v.status === 'FINISHED' ? 'REVEALED' : 'COMMITTED', commitment: v.fairnessCommitment, example: true,
      ...(v.status === 'FINISHED' ? { serverSeed: '42', crashMultiplier: v.crashMultiplier, boosterLevel: v.boosterLevel, verified: false } : {}) }
  }
  private advance(r: StoredRound) {
    const v = r.view
    // Fixtures are deliberately not a production probability model. Fixed 100ms steps
    // make delayed timers, reload and injected-clock tests produce identical outcomes.
    const end = r.preset === 'LOSE' ? 80 : r.preset === 'BOOSTER' ? 220 : 180
    const target = Math.min(end, Math.floor((this.now() - Date.parse(v.startedAt)) / 100))
    const before = r.processed
    while (r.processed < target && v.status !== 'FINISHED') {
      r.processed++
      const base = 1 + r.processed * 0.012
      v.currentMultiplier = Math.round(base * (v.boosterActivated ? v.boosterMultiplier : 1) * 10000) / 10000
      if (r.processed === end) {
        v.cashoutAvailable = false; v.status = 'FINISHED'; v.crashMultiplier = v.currentMultiplier
        v.outcome = v.cashoutPerformed ? 'CASHED_OUT' : 'LOSS'; v.finishedAt = new Date(Date.parse(v.startedAt) + end * 100).toISOString()
        // Future booster is only revealed here or on activation.
        if (v.boosterMultiplier > 1) v.boosterLevel = 3
        v.fairnessReveal = this.proof(r)
        this.emit(r, 'CRASH', { crashMultiplier: v.crashMultiplier, fairnessReveal: v.fairnessReveal })
        this.emit(r, 'ROUND_FINISHED', {})
        break
      }
      while (v.currentLevel < v.totalLevels && v.currentMultiplier >= v.levelThresholds[v.currentLevel]) {
        v.currentLevel++
        const points = v.cashoutPerformed ? 0 : mockCatalog.pointsPerLevel
        this.award(r, points); v.cashoutAvailable = !v.cashoutPerformed
        this.emit(r, 'LEVEL_REACHED', { level: v.currentLevel, multiplier: v.currentMultiplier, points, pointsToAward: points })
        if (v.currentLevel === 3 && v.boosterMultiplier > 1 && !v.cashoutPerformed && !v.boosterActivated) {
          const before = v.currentMultiplier; v.boosterActivated = true; v.boosterLevel = 3
          v.currentMultiplier = Math.round(base * v.boosterMultiplier * 10000) / 10000
          const bonus = v.boosterMultiplier * 100; this.award(r, bonus)
          this.emit(r, 'BOOSTER_ACTIVATED', { booster: v.boosterMultiplier, level: 3, beforeMultiplier: before, afterMultiplier: v.currentMultiplier, points: bonus, pointsToAward: bonus })
        }
      }
      this.emit(r, 'MULTIPLIER_UPDATE', { multiplier: v.currentMultiplier, level: v.currentLevel })
    }
    return r.processed !== before
  }
  tick = () => {
    let changed = false
    Object.values(this.db.rounds).forEach(r => { if (r.view.status !== 'FINISHED') changed = this.advance(r) || changed })
    const active = Object.values(this.db.rounds).some(r => r.view.status !== 'FINISHED')
    if (changed) this.save()
    if (!active && this.timer) { clearInterval(this.timer); this.timer = undefined }
  }
  dispose = () => { clearInterval(this.timer); clearTimeout(this.reconnectTimer); this.listeners.clear() }
  api: Api = {
    mode: 'mock',
    auth: {
      demos: demoUsers,
      currentUser: async () => demoUsers.find(u => u.id === this.storage.getItem(SESSION_KEY)) ?? null,
      login: async (login, password) => {
        const u = demoUsers.find(u => u.login === login.trim() && u.password === password)
        if (!u) throw new Error('Проверьте логин и пароль или выберите демо-профиль ниже.')
        this.storage.setItem(SESSION_KEY, u.id); return u
      },
      logout: async () => { this.storage.removeItem(SESSION_KEY) },
    },
    economy: { getBalance: async id => { this.tick(); return clone(this.db.wallets[id]) } },
    catalog: { get: async () => clone(mockCatalog) },
    history: { getHistory: async (page = 0) => {
      this.tick(); const currentUser = this.user()
      const items: HistoryItem[] = Object.values(this.db.rounds).filter(r => r.owner === currentUser && r.view.status === 'FINISHED').map(({ view: v, owner }) => ({ roundId: v.id, username: owner, theme: v.theme, betAmount: v.betAmount, boosterMultiplier: v.boosterMultiplier, cashoutMultiplier: v.cashoutMultiplier, crashMultiplier: v.crashMultiplier!, winAmount: v.winAmount, roundScore: v.roundScore, result: v.cashoutPerformed ? 'WIN' : 'LOSS', finishedAt: v.finishedAt! }))
      items.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt) || b.roundId.localeCompare(a.roundId))
      return { items: items.slice(page * 10, (page + 1) * 10), page, size: 10, total: items.length }
    } },
    game: {
      startRound: async (input: StartInput) => {
        this.requireOnline(); const owner = this.user(); this.tick()
        if (Object.values(this.db.rounds).some(r => r.owner === owner && r.view.status !== 'FINISHED')) throw new Error('У вас уже есть активный раунд. Восстановите его.')
        if (!mockCatalog.stakes.includes(input.betAmount) || !mockCatalog.boosters.includes(input.boosterMultiplier) || !mockCatalog.thresholds[input.theme]) throw new Error('Недопустимый вариант ставки.')
        this.debit(owner, input.betAmount)
        const id = `demo-${++this.db.counter}`; const date = new Date(this.now()).toISOString()
        const r: StoredRound = { owner, preset: this.preset, processed: 0, events: [], view: { ...input, id, roundId: id, boosterActivated: false, currentMultiplier: 1, currentLevel: 0, totalLevels: mockCatalog.thresholds[input.theme].length, levelThresholds: [...mockCatalog.thresholds[input.theme]], cashoutAvailable: false, cashoutPerformed: false, winAmount: 0, roundScore: 0, status: 'RUNNING', startedAt: date, timestamp: date, serverTime: date, sequence: 0, fairnessCommitment: 'DEMO · пример commitment, не криптографическое доказательство' } }
        this.db.rounds[id] = r; this.emit(r, 'ROUND_STARTED', {}); this.save(); this.ensureTimer(); return this.publicRound(r)
      },
      cashout: async id => {
        this.requireOnline(); const r = this.owned(id); this.tick(); const v = r.view
        if (v.cashoutPerformed) return this.publicRound(r)
        if (!v.cashoutAvailable || v.status !== 'RUNNING') throw new Error('Забрать можно после первого уровня и до падения.')
        v.cashoutPerformed = true; v.cashoutAvailable = false; v.cashoutMultiplier = v.currentMultiplier
        v.winAmount = Math.floor(v.betAmount * v.currentMultiplier); v.status = 'CASHED_OUT'
        this.credit(r.owner, v.winAmount); this.award(r, mockCatalog.cashoutPoints)
        this.emit(r, 'CASHOUT_SUCCESS', { multiplier: v.cashoutMultiplier, cashoutMultiplier: v.cashoutMultiplier, winAmount: v.winAmount })
        this.save(); return this.publicRound(r)
      },
      getSnapshot: async id => { this.requireOnline(); const r = this.owned(id); this.tick(); return this.publicRound(r) },
      getReplay: async (id, after) => { this.requireOnline(); const r = this.owned(id); this.tick(); const oldest = r.events[0]?.sequence ?? 1; return { roundId: id, events: clone(r.events.filter(e => e.sequence > after)), oldestAvailableSequence: oldest, latestSequence: r.view.sequence, snapshotRequired: after < oldest - 1 || after > r.view.sequence, serverTime: new Date(this.now()).toISOString() } },
      getFairness: async id => { this.requireOnline(); const r = this.owned(id); this.tick(); return this.proof(r) },
      getResult: async id => { const r = this.owned(id); this.tick(); const v = r.view; if (v.status !== 'FINISHED') throw new Error('Раунд ещё не завершён.'); return { roundId: id, result: v.cashoutPerformed ? 'WIN' : 'LOSS', betAmount: v.betAmount, cashoutMultiplier: v.cashoutMultiplier, crashMultiplier: v.crashMultiplier!, winAmount: v.winAmount, score: v.roundScore, reward: { type: 'CLOUD', rarity: 'COMMON' } } },
      connect: async (event, connection) => {
        const listener = { event, connection }; this.listeners.add(listener); connection(this.online ? 'connected' : 'disconnected')
        if (Object.values(this.db.rounds).some(r => r.view.status !== 'FINISHED')) this.ensureTimer()
        return () => { this.listeners.delete(listener); if (!this.listeners.size) { clearInterval(this.timer); this.timer = undefined } }
      },
    },
    dev: {
      setPreset: p => { this.preset = p },
      setBalance: (id, balance) => { this.db.wallets[id].bonusBalance = balance; this.save() },
      disconnect: () => {
        this.online = false; this.listeners.forEach(l => l.connection('disconnected'))
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = setTimeout(() => { this.tick(); this.online = true; this.listeners.forEach(l => l.connection('connected')) }, 2500)
      },
    },
  }
}

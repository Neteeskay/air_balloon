import { demoUsers, SESSION_KEY } from './demoUsers'
import type { Api, Catalog, Connection, Fairness, GameEvent, HistoryItem, PlayerCharacter, PlayerCharacterCode, Preset, Round, Scenario8Offer, Scenario8Purchase, StartInput, Wallet } from './types'

export const mockCatalog: Catalog = {
  stakes: [100, 250, 500, 1000], stakeRules: { minimum: 1, maximum: 1000, decimalPlaces: 0 },
  boosters: [1, 2, 3, 4], levels: { GREEN: 9, RED: 12 }, pointsPerLevel: 100, cashoutPoints: 50,
}
const thresholds: Record<'GREEN' | 'RED', number[]> = { GREEN: [1.2, 1.5, 2, 3, 4, 6, 8, 10, 12], RED: [1.2, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20] }
const playerCharacters: Record<PlayerCharacterCode, PlayerCharacter> = {
  CAUTIOUS: { code: 'CAUTIOUS', title: 'Осторожный', description: 'Не стал рисковать и забрал выигрыш заранее' },
  COLD_BLOODED: { code: 'COLD_BLOODED', title: 'Хладнокровный', description: 'Уверенно забрал на высоком коэффициенте' },
  CLOSE_CALL: { code: 'CLOSE_CALL', title: 'На волоске', description: 'Забрал выигрыш буквально перед Crash' },
  BOOSTER_HUNTER: { code: 'BOOSTER_HUNTER', title: 'Охотник за бустером', description: 'Дождался бустера и успешно забрал выигрыш' },
  GREEDY: { code: 'GREEDY', title: 'Жадина', description: 'Рискнул подняться выше, но шар не выдержал' },
  ADVENTURER: { code: 'ADVENTURER', title: 'Искатель высоты', description: 'Каждый полёт — новый шанс подняться выше' },
}
const playerCharacter = (round: Round): PlayerCharacter => {
  const cashout = round.cashoutMultiplier; let code: PlayerCharacterCode = 'ADVENTURER'
  if (cashout !== undefined && round.boosterActivated) code = 'BOOSTER_HUNTER'
  else if (cashout !== undefined && round.crashMultiplier !== undefined && round.crashMultiplier - cashout >= 0 && round.crashMultiplier - cashout <= .15) code = 'CLOSE_CALL'
  else if (cashout !== undefined && cashout >= 5) code = 'COLD_BLOODED'
  else if (cashout !== undefined && cashout >= round.levelThresholds[0] && cashout < round.levelThresholds[1]) code = 'CAUTIOUS'
  else if (cashout === undefined && round.currentLevel >= 3) code = 'GREEDY'
  return { ...playerCharacters[code] }
}
type StoredRound = { view: Round; owner: string; preset: Preset; processed: number; events: GameEvent[] }
type StoredOffer = Scenario8Offer & { owner: string; idempotencyKey?: string; purchase?: Scenario8Purchase }
type Database = { version: 2; wallets: Record<string, Wallet>; rounds: Record<string, StoredRound>; offers: Record<string, StoredOffer>; counter: number }
const DATA_KEY = 'air-balloon-game-mock-v1'
const clone = <T,>(value: T): T => structuredClone(value)
const initial = (): Database => ({ version: 2, wallets: Object.fromEntries(demoUsers.map(u => [u.id, { bonusBalance: 5000, gameScore: 0, lotteryTicketCount: 0 }])), rounds: {}, offers: {}, counter: 0 })

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
    try {
      const parsed = saved ? JSON.parse(saved) : null
      this.db = parsed?.version === 2 ? parsed : initial()
      Object.values(this.db.wallets).forEach(wallet => { wallet.lotteryTicketCount ??= 0 })
      this.db.offers ??= {}
    }
    catch { this.db = initial() }
  }
  private save() { this.storage.setItem(DATA_KEY, JSON.stringify(this.db)) }
  private ensureTimer() { if (this.autoTick && !this.timer) this.timer = setInterval(this.tick, 100) }
  private user() { const id = this.storage.getItem(SESSION_KEY); if (!id || !this.db.wallets[id]) throw new Error('Войдите в тестовый профиль.'); return id }
  private owned(id: string) { const r = this.db.rounds[id]; if (!r || r.owner !== this.user()) throw new Error('Раунд не найден для этого профиля.'); return r }
  private requireOnline() { if (!this.online) throw new Error('Соединение потеряно. Восстанавливаем состояние…') }
  private publicRound(r: StoredRound) { return clone(r.view) }
  private preview(v: Round) { return Math.floor(v.betAmount * v.currentMultiplier) }
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
      v.cashoutPreviewAmount = v.status === 'RUNNING' ? this.preview(v) : undefined
      if (r.processed === end) {
        v.cashoutAvailable = false; v.cashoutPreviewAmount = undefined; v.status = 'FINISHED'; v.crashMultiplier = v.currentMultiplier
        v.outcome = v.cashoutPerformed ? 'CASHED_OUT' : 'LOSS'; v.finishedAt = new Date(Date.parse(v.startedAt) + end * 100).toISOString()
        v.fairnessReveal = this.proof(r)
        this.emit(r, 'CRASH', { crashMultiplier: v.crashMultiplier, fairnessReveal: v.fairnessReveal })
        this.emit(r, 'ROUND_FINISHED', {})
        break
      }
      while (v.currentLevel < v.totalLevels && v.currentMultiplier >= v.levelThresholds[v.currentLevel]) {
        v.currentLevel++
        const points = v.cashoutPerformed ? 0 : (mockCatalog.pointsPerLevel ?? 100)
        this.award(r, points); v.cashoutAvailable = !v.cashoutPerformed
        this.emit(r, 'LEVEL_REACHED', { level: v.currentLevel, multiplier: v.currentMultiplier, cashoutPreviewAmount: v.cashoutPreviewAmount, points, pointsToAward: points })
        if (v.currentLevel === 3 && v.boosterMultiplier > 1 && !v.cashoutPerformed && !v.boosterActivated) {
          const before = v.currentMultiplier; v.boosterActivated = true
          v.currentMultiplier = Math.round(base * v.boosterMultiplier * 10000) / 10000
          v.cashoutPreviewAmount = this.preview(v)
          const bonus = v.boosterMultiplier * 100; this.award(r, bonus)
          this.emit(r, 'BOOSTER_ACTIVATED', { booster: v.boosterMultiplier, level: 3, beforeMultiplier: before, afterMultiplier: v.currentMultiplier, cashoutPreviewAmount: v.cashoutPreviewAmount, points: bonus, pointsToAward: bonus })
        }
      }
      this.emit(r, 'MULTIPLIER_UPDATE', { multiplier: v.currentMultiplier, level: v.currentLevel, cashoutPreviewAmount: v.cashoutPreviewAmount })
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
    economy: { getBalance: async id => { this.tick(); return clone(this.db.wallets[id ?? this.user()]) } },
    upsell: {
      getOffer: async roundId => {
        this.tick(); const r = this.owned(roundId); const v = r.view
        if (v.status !== 'FINISHED' || !v.cashoutPerformed) return null
        const current = Object.values(this.db.offers).find(o => o.roundId === roundId)
        if (current) return clone(current)
        const offer: StoredOffer = { offerId: `offer-${roundId}`, roundId, price: 150, ticketCount: 3, minWinAmount: 0, expiresAt: new Date(this.now() + 600_000).toISOString(), status: 'AVAILABLE', owner: r.owner }
        this.db.offers[offer.offerId] = offer; this.save(); return clone(offer)
      },
      purchase: async (offerId, key) => {
        this.requireOnline(); const offer = this.db.offers[offerId]; const owner = this.user()
        if (!offer || offer.owner !== owner) throw new Error('Предложение не найдено для этого профиля.')
        if (offer.purchase) { if (offer.idempotencyKey === key) return { ...clone(offer.purchase), replayed: true }; throw new Error('Предложение уже использовано') }
        if (Date.parse(offer.expiresAt) <= this.now()) { offer.status = 'EXPIRED'; this.save(); throw new Error('Срок предложения истёк') }
        const wallet = this.db.wallets[owner]; if (wallet.bonusBalance < offer.price) throw new Error('Недостаточно бонусов для покупки билетов')
        wallet.bonusBalance -= offer.price; wallet.lotteryTicketCount = (wallet.lotteryTicketCount ?? 0) + offer.ticketCount
        const purchase: Scenario8Purchase = { offerId, roundId: offer.roundId, price: offer.price, ticketCount: offer.ticketCount, bonusBalance: wallet.bonusBalance, lotteryTicketCount: wallet.lotteryTicketCount, replayed: false }
        offer.purchase = purchase; offer.idempotencyKey = key; offer.status = 'CONSUMED'; this.save(); return clone(purchase)
      },
    },
    catalog: { get: async () => clone(mockCatalog) },
    history: {
      getGlobalHistory: async (page = 0) => this.historyPage(page),
      getPersonalHistory: async (page = 0) => this.historyPage(page, this.user()),
    },
    game: {
      startRound: async (input: StartInput) => {
        this.requireOnline(); const owner = this.user(); this.tick()
        if (Object.values(this.db.rounds).some(r => r.owner === owner && r.view.status !== 'FINISHED')) throw new Error('У вас уже есть активный раунд. Восстановите его.')
        if (!mockCatalog.stakes.includes(input.betAmount) || !mockCatalog.boosters.includes(input.boosterMultiplier) || !thresholds[input.theme]) throw new Error('Недопустимый вариант ставки.')
        this.debit(owner, input.betAmount)
        const id = `demo-${++this.db.counter}`; const date = new Date(this.now()).toISOString()
        const r: StoredRound = { owner, preset: this.preset, processed: 0, events: [], view: { ...input, id, roundId: id, boosterActivated: false, ...(input.boosterMultiplier > 1 ? { boosterLevel: 3 } : {}), currentMultiplier: 1, currentLevel: 0, totalLevels: thresholds[input.theme].length, levelThresholds: [...thresholds[input.theme]], cashoutAvailable: false, cashoutPerformed: false, cashoutPreviewAmount: input.betAmount, winAmount: 0, roundScore: 0, status: 'RUNNING', startedAt: date, timestamp: date, serverTime: date, sequence: 0, fairnessCommitment: 'DEMO · пример commitment, не криптографическое доказательство' } }
        this.db.rounds[id] = r; this.emit(r, 'ROUND_STARTED', {}); this.save(); this.ensureTimer(); return this.publicRound(r)
      },
      cashout: async id => {
        this.requireOnline(); const r = this.owned(id); this.tick(); const v = r.view
        if (v.cashoutPerformed) return this.publicRound(r)
        if (!v.cashoutAvailable || v.status !== 'RUNNING') throw new Error('Забрать можно после первого уровня и до падения.')
        v.cashoutPerformed = true; v.cashoutAvailable = false; v.cashoutMultiplier = v.currentMultiplier
        v.winAmount = v.cashoutPreviewAmount!; v.cashoutPreviewAmount = undefined; v.status = 'CASHED_OUT'
        this.credit(r.owner, v.winAmount); this.award(r, mockCatalog.cashoutPoints ?? 50)
        this.emit(r, 'CASHOUT_SUCCESS', { multiplier: v.cashoutMultiplier, cashoutMultiplier: v.cashoutMultiplier, winAmount: v.winAmount })
        this.save(); return this.publicRound(r)
      },
      getSnapshot: async id => { this.requireOnline(); const r = this.owned(id); this.tick(); return this.publicRound(r) },
      getReplay: async (id, after) => { this.requireOnline(); const r = this.owned(id); this.tick(); const oldest = r.events[0]?.sequence ?? 1; return { roundId: id, events: clone(r.events.filter(e => e.sequence > after)), oldestAvailableSequence: oldest, latestSequence: r.view.sequence, snapshotRequired: after < oldest - 1 || after > r.view.sequence, serverTime: new Date(this.now()).toISOString() } },
      getFairness: async id => { this.requireOnline(); const r = this.owned(id); this.tick(); return this.proof(r) },
      getResult: async id => { const r = this.owned(id); this.tick(); const v = r.view; if (v.status !== 'FINISHED') throw new Error('Раунд ещё не завершён.'); return { roundId: id, result: v.cashoutPerformed ? 'WIN' : 'LOSS', betAmount: v.betAmount, cashoutMultiplier: v.cashoutMultiplier, crashMultiplier: v.crashMultiplier!, winAmount: v.winAmount, potentialWinAmount: Math.floor(v.betAmount * v.crashMultiplier!), score: v.roundScore, playerCharacter: playerCharacter(v), reward: { type: 'CLOUD', rarity: 'COMMON' } } },
      connect: async (event, connection) => {
        const listener = { event, connection }; this.listeners.add(listener); connection(this.online ? 'connected' : 'disconnected')
        if (Object.values(this.db.rounds).some(r => r.view.status !== 'FINISHED')) this.ensureTimer()
        return () => { this.listeners.delete(listener); if (!this.listeners.size) { clearInterval(this.timer); this.timer = undefined } }
      },
    },
    tournament: {
      getActive: async () => ({ active: false }),
      getLeaderboard: async () => { throw new Error('В демо сейчас нет активного турнира.') },
      join: async () => {},
      connect: async (_id, _update, connection) => { connection('connected'); return () => {} },
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

  private historyPage(page: number, owner?: string) {
    this.tick()
    const items: HistoryItem[] = Object.values(this.db.rounds)
      .filter(r => (!owner || r.owner === owner) && r.view.status === 'FINISHED')
      .map(({ view: v, owner: roundOwner }) => ({ roundId: v.id, username: roundOwner, theme: v.theme, betAmount: v.betAmount, boosterMultiplier: v.boosterMultiplier, cashoutMultiplier: v.cashoutMultiplier, crashMultiplier: v.crashMultiplier!, winAmount: v.winAmount, score: v.roundScore, result: v.cashoutPerformed ? 'WIN' : 'LOSS', completedAt: v.finishedAt! }))
    items.sort((a, b) => b.completedAt.localeCompare(a.completedAt) || b.roundId.localeCompare(a.roundId))
    return { items: items.slice(page * 10, (page + 1) * 10), page, size: 10, total: items.length }
  }
}

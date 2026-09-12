import type { Connection, GameApi, GameEvent, Round, StartInput } from '../api/types'

export type SoundCue = { type: 'LEVEL_REACHED' | 'BOOSTER_ACTIVATED'; roundId: string; sequence: number }
export type SessionState = { round: Round | null; connection: Connection; busy: boolean; error: string; recovered: number; notice: string; sound: SoundCue | null }
/** Transport state only. No crash, payout, position or score rules are decided here. */
export class GameSession {
  private state: SessionState = { round: null, connection: 'connecting', busy: false, error: '', recovered: 0, notice: '', sound: null }
  private listeners = new Set<() => void>()
  private stop?: () => void
  private opening?: Promise<void>
  private syncing?: Promise<void>
  private buffer: GameEvent[] = []
  private disposed = false
  private cashoutKey = ''
  private startKey = ''
  private startInput = ''
  constructor(private game: GameApi, private remember: (id: string | null) => void = () => {}) {}
  getSnapshot = () => this.state
  activate = () => { this.disposed = false }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  clearError = () => this.set({ error: '' })
  private set(patch: Partial<SessionState>) { if (this.disposed) return; this.state = { ...this.state, ...patch }; this.listeners.forEach(l => l()) }
  private install(round: Round) {
    const previous = this.state.round
    if (previous?.id === round.id && previous.sequence > round.sequence) return
    this.set({ round }); this.remember(round.id)
  }
  private applyEvent = (e: GameEvent, realtime = false) => {
    const round = this.state.round
    if (!round) { this.buffer.push(e); this.buffer = this.buffer.slice(-256); return }
    if (e.roundId !== round.id || e.sequence <= round.sequence) return
    if (e.sequence !== round.sequence + 1) { this.buffer.push(e); void this.recover(); return }
    const next = { ...round, sequence: e.sequence, timestamp: e.timestamp, serverTime: e.serverTime }
    const d = e.data
    const preview = d.cashoutPreviewAmount
    if (typeof preview === 'number' || typeof preview === 'string') next.cashoutPreviewAmount = Number(preview)
    let notice = ''
    let sound: SoundCue | null = null
    switch (e.type) {
      case 'ROUND_STARTED': case 'ROUND_FINISHED': this.install(d.round as Round); return
      case 'MULTIPLIER_UPDATE': next.currentMultiplier = Number(d.multiplier); next.currentLevel = Number(d.level); break
      case 'LEVEL_REACHED':
        next.currentLevel = Number(d.level); next.currentMultiplier = Number(d.multiplier)
        next.roundScore += Number(d.pointsToAward); next.cashoutAvailable = !next.cashoutPerformed
        notice = Number(d.pointsToAward) ? `Уровень ${d.level} · +${d.pointsToAward} очков` : `Уровень ${d.level} пройден`
        if (realtime) sound = { type: 'LEVEL_REACHED', roundId: e.roundId, sequence: e.sequence }
        break
      case 'BOOSTER_ACTIVATED':
        next.boosterActivated = true; next.boosterLevel = Number(d.level); next.currentMultiplier = Number(d.afterMultiplier); next.roundScore += Number(d.pointsToAward)
        notice = `Бустер ×${d.booster} активирован · +${d.pointsToAward} очков`
        if (realtime) sound = { type: 'BOOSTER_ACTIVATED', roundId: e.roundId, sequence: e.sequence }
        break
      case 'CASHOUT_SUCCESS':
        next.cashoutPerformed = true; next.cashoutAvailable = false; next.cashoutMultiplier = Number(d.cashoutMultiplier); next.winAmount = Number(d.winAmount); next.status = 'CASHED_OUT'; break
      case 'CRASH': next.status = 'CRASHED'; next.cashoutAvailable = false; next.crashMultiplier = Number(d.crashMultiplier); break
      default: void this.recover(); return
    }
    this.install(next)
    if (notice || sound) this.set({ ...(notice ? { notice } : {}), ...(sound ? { sound } : {}) })
  }
  private event = (e: GameEvent) => {
    if (this.syncing || this.state.connection !== 'connected') {
      this.buffer.push(e); this.buffer = this.buffer.slice(-256); return
    }
    this.applyEvent(e, true)
  }
  private async connect() {
    if (this.stop) return
    if (this.opening) return this.opening
    this.disposed = false
    this.opening = this.game.connect(this.event, status => {
      this.set({ connection: status })
      if (status === 'connected' && this.state.round) void this.recover()
    }).then(stop => { if (this.disposed) stop(); else this.stop = stop }).finally(() => { this.opening = undefined })
    return this.opening
  }
  recover = async (id = this.state.round?.id) => {
    if (!id) return
    if (this.syncing) return this.syncing
    this.set({ connection: 'recovering', error: '' })
    // Stream is opened before snapshot; new messages are buffered while awaiting HTTP.
    this.syncing = (async () => {
      try {
        await this.connect()
        // Contract order: open and buffer the stream, then establish an authoritative snapshot cursor.
        let snapshot = await this.game.getSnapshot(id)
        this.install(snapshot)
        let pending = this.buffer.splice(0).filter(event => event.roundId === id && event.sequence > snapshot.sequence)
          .sort((a, b) => a.sequence - b.sequence)
        pending = pending.filter((event, index) => index === 0 || event.sequence !== pending[index - 1].sequence)
        if (pending.length && pending[0].sequence !== snapshot.sequence + 1) {
          const replay = await this.game.getReplay(id, snapshot.sequence)
          if (replay.snapshotRequired) {
            snapshot = await this.game.getSnapshot(id); this.install(snapshot)
            pending = this.buffer.splice(0).filter(event => event.roundId === id && event.sequence > snapshot.sequence)
          } else {
            pending = [...replay.events, ...pending].sort((a, b) => a.sequence - b.sequence)
              .filter((event, index, events) => index === 0 || event.sequence !== events[index - 1].sequence)
          }
        }
        pending.forEach(event => this.applyEvent(event))
        this.set({ connection: 'connected', recovered: this.state.recovered + 1, error: '' })
      } catch (e) { this.set({ connection: 'disconnected', error: message(e) }) }
    })()
    await this.syncing; this.syncing = undefined
    const pending = this.buffer.splice(0).sort((a, b) => a.sequence - b.sequence)
    // Anything accumulated during recovery is replay/snapshot-adjacent and must be silent.
    pending.forEach(event => this.applyEvent(event))
  }
  start = async (input: StartInput) => {
    if (this.state.busy) return
    this.set({ busy: true, error: '', notice: '' })
    try {
      await this.connect()
      const serialized = JSON.stringify(input)
      if (serialized !== this.startInput) { this.startInput = serialized; this.startKey = crypto.randomUUID() }
      const round = await this.game.startRound(input, this.startKey)
      this.cashoutKey = crypto.randomUUID(); this.install(round)
      this.buffer.splice(0).sort((a, b) => a.sequence - b.sequence).forEach(this.event)
    } catch (e) { this.set({ error: `${message(e)} Повтор старта не выполняется автоматически.` }) }
    finally { this.set({ busy: false }) }
  }
  cashout = async () => {
    const r = this.state.round
    if (!r || !r.cashoutAvailable || this.state.busy || this.state.connection !== 'connected') return
    this.set({ busy: true, error: '' }); this.cashoutKey ||= crypto.randomUUID()
    try { this.install(await this.game.cashout(r.id, this.cashoutKey)) }
    catch (e) { const error = message(e); await this.recover(); this.set({ error }) }
    finally { this.set({ busy: false }) }
  }
  again = () => { if (this.state.round && this.state.round.status !== 'FINISHED') return; this.remember(null); this.buffer = []; this.startKey = ''; this.startInput = ''; this.set({ round: null, error: '', notice: '', sound: null }) }
  dispose = () => { this.disposed = true; this.stop?.(); this.stop = undefined; this.listeners.clear() }
}
export const message = (e: unknown) => e instanceof Error ? e.message : 'Не удалось выполнить действие. Попробуйте ещё раз.'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Api, Connection, Fairness, HistoryPage, Leaderboard, Result, Round, Tournament } from '../api/types'
import { multiplier, number } from '../game/format'
import { message } from '../game/session'

export function ResultScreen({ api, round: r, onAgain, onHistory, onFairness }: { api: Api; round: Round; onAgain: () => void; onHistory: () => void; onFairness: () => void }) {
  const [result, setResult] = useState<Result | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [attempt, setAttempt] = useState(0)
  useEffect(() => { let live = true; api.game.getResult(r.id).then(value => { if (live) setResult(value) }).catch(e => { if (live) { setResult(null); setError(message(e)) } }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [api, r.id, attempt])
  const retry = () => { setResult(null); setError(''); setLoading(true); setAttempt(n => n + 1) }
  const won = (result?.result ?? (r.cashoutPerformed ? 'WIN' : 'LOSS')) === 'WIN'
  return <section className={`result-card ${won ? 'win' : 'loss'}`}><span className="result-symbol" aria-hidden="true">{won ? '✧' : '↘'}</span><p className="eyebrow">{r.theme} / ПОЛЁТ ЗАВЕРШЁН</p><h2>{won ? 'Отлично поймали момент!' : 'В этот раз — чуть выше риска'}</h2><p>{won ? 'Выигрыш уже на бонусном балансе.' : 'Вы не успели забрать. Ставка списана, игровые очки сохранены.'}</p><div className="result-amount">{won ? `+${number(result?.winAmount ?? r.winAmount)}` : '0'} <span>бонусов</span></div><span className={`outcome ${won ? 'won' : ''}`}>{won ? 'WIN · Выигрыш' : 'LOSE · Проигрыш'}</span><dl className="result-details"><div><dt>Ставка</dt><dd>{number(result?.betAmount ?? r.betAmount)}</dd></div><div><dt>Cashout</dt><dd>{(result?.cashoutMultiplier ?? r.cashoutMultiplier) ? multiplier((result?.cashoutMultiplier ?? r.cashoutMultiplier)!) : 'Не выполнен'}</dd></div><div><dt>Crash</dt><dd>{multiplier(result?.crashMultiplier ?? r.crashMultiplier!)}</dd></div><div><dt>Игровые очки</dt><dd>+{number(result?.score ?? r.roundScore)}</dd></div><div><dt>Бустер</dt><dd>{r.boosterActivated ? `×${r.boosterMultiplier} · активирован` : 'Не активирован'}</dd></div><div><dt>Награда</dt><dd>{result?.reward ? `${result.reward.type === 'CLOUD' ? '☁ Облачко' : result.reward.type} · ${result.reward.rarity}` : result ? 'Нет' : loading ? 'Загружаем…' : 'Недоступно'}</dd></div></dl>{error && <p className="error" role="alert">{error} <button onClick={retry}>Повторить</button></p>}<div className="result-actions"><button className="primary" onClick={onAgain}>Играть снова ↗</button><button className="secondary" onClick={onHistory}>История</button></div><button className="fairness-link" onClick={onFairness}>◇ Проверить честность</button></section>
}
export function History({ api, onBack }: { api: Api; onBack: () => void }) {
  const [history, setHistory] = useState<HistoryPage | null>(null); const [page, setPage] = useState(0); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0)
  useEffect(() => { let live = true; api.history.getHistory(page).then(h => { if (live) setHistory(h) }).catch(e => { if (live) setError(message(e)) }); return () => { live = false } }, [api, page, attempt])
  const loadPage = (next: number) => { setHistory(null); setError(''); setPage(next) }; const retry = () => { setHistory(null); setError(''); setAttempt(n => n + 1) }
  return <section className="history-card"><div className="history-title"><div><h2>Каждый полёт — своя история</h2><p>Ваши завершённые игры · {api.mode === 'mock' ? 'локальное демо' : 'личная история сервера'}</p></div><button className="secondary" onClick={onBack}>К игре ↗</button></div>{error ? <p className="error" role="alert">{error} <button onClick={retry}>Повторить</button></p> : !history ? <p role="status" className="loading">Загружаем историю…</p> : !history.items.length ? <div className="empty-state"><span>☁</span><h3>Небо пока без следов</h3><p>Завершите первый полёт — он появится здесь.</p></div> : <><div className="history-list">{history.items.map(h => <article key={h.roundId} className="history-row"><span className={`history-icon ${h.theme.toLowerCase()}`}>↗</span><div><strong>{h.theme} {h.username && <small>@{h.username}</small>}</strong><span>{new Date(h.completedAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div><div><span>Ставка</span><strong>{number(h.betAmount)}</strong></div><div><span>{h.cashoutMultiplier ? 'Cashout' : 'Crash'}</span><strong>{multiplier(h.cashoutMultiplier ?? h.crashMultiplier)}</strong></div><div className={h.result === 'WIN' ? 'history-win' : ''}><span>{h.result === 'WIN' ? 'WIN' : 'LOSE'} · {number(h.score)} ✧</span><strong>+{number(h.winAmount)}</strong></div></article>)}</div><div className="pagination"><button className="secondary" disabled={page === 0} onClick={() => loadPage(page - 1)}>Назад</button><span>{page + 1} / {Math.max(1, Math.ceil(history.total / history.size))}</span><button className="secondary" disabled={(page + 1) * history.size >= history.total} onClick={() => loadPage(page + 1)}>Далее</button></div></>}</section>
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null); const previousFocus = useRef<HTMLElement | null>(null)
  useEffect(() => { const node = dialog.current!; previousFocus.current = document.activeElement as HTMLElement | null; node.showModal(); return () => { if (node.open) node.close(); previousFocus.current?.focus() } }, [])
  return <dialog ref={dialog} className="modal" aria-labelledby="modal-title" onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === dialog.current) onClose() }}><div className="modal-heading"><h2 id="modal-title">{title}</h2><button autoFocus aria-label="Закрыть" onClick={onClose}>×</button></div>{children}</dialog>
}
export function FairnessDialog({ api, round, onClose }: { api: Api; round: Round; onClose: () => void }) {
  const [proof, setProof] = useState<Fairness | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [attempt, setAttempt] = useState(0)
  useEffect(() => { let live = true; api.game.getFairness(round.id).then(p => { if (live) setProof(p) }).catch(e => { if (live) { setProof(null); setError(message(e)) } }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [api, round.id, round.status, attempt])
  const retry = () => { setProof(null); setError(''); setLoading(true); setAttempt(n => n + 1) }
  return <Modal title="Проверить честность" onClose={onClose}><p className="muted">Commitment фиксируется до начала. Reveal открывается только после падения — не после cashout.</p><h3>Сохранённый commitment</h3><code className="proof-code">{round.fairnessCommitment}</code>{error && <p role="alert" className="error">{error} <button onClick={retry}>Повторить</button></p>}{loading ? <p role="status">Загружаем proof…</p> : proof ? <><h3>Reveal</h3>{proof.status === 'COMMITTED' ? <p>Скрыт до завершения полёта.</p> : <dl className="proof-details"><dt>Server seed</dt><dd>{proof.serverSeed}</dd><dt>Crash</dt><dd>{proof.crashMultiplier}</dd><dt>Уровень бустера</dt><dd>{proof.boosterLevel ?? 'Нет'}</dd></dl>}<h3>Статус проверки</h3><p className={proof.verified === false && !proof.example ? 'error' : 'info'}>{proof.example ? 'MOCK EXAMPLE — демонстрационные данные, не настоящее доказательство честности.' : proof.status === 'COMMITTED' ? 'Ожидаем reveal.' : proof.verified === true ? 'VERIFIED · SHA-256 commitment совпадает с независимо собранным canonical proof.' : proof.verified === false ? 'VERIFICATION FAILED · proof не совпадает с первоначальным commitment.' : 'Reveal получен, но Web Crypto недоступен для независимой проверки.'}</p></> : null}</Modal>
}

export function TournamentPanel({ api, onBack }: { api: Api; onBack: () => void }) {
  const [tournament, setTournament] = useState<Tournament | null>(null); const [board, setBoard] = useState<Leaderboard | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting'); const [error, setError] = useState(''); const [attempt, setAttempt] = useState(0); const [now, setNow] = useState(() => Date.now())
  const revision = useRef(0); const syncing = useRef(false)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])
  useEffect(() => {
    let live = true; let stop: (() => void) | undefined
    const snapshot = async (id: string) => {
      if (syncing.current) return; syncing.current = true
      try { const value = await api.tournament.getLeaderboard(id); if (live) { revision.current = value.tournament.revision; setTournament(value.tournament); setBoard(value); setError('') } }
      catch (e) { if (live) setError(message(e)) } finally { syncing.current = false }
    }
    api.tournament.getActive().then(async active => {
      if (!live || !active.active || !active.tournament) { if (live) { setTournament(null); setConnection('connected') }; return }
      setTournament(active.tournament)
      await snapshot(active.tournament.id)
      stop = await api.tournament.connect(active.tournament.id, update => {
        if (update.revision <= revision.current) return
        // Public STOMP frames intentionally omit names; refresh the viewer-specific snapshot.
        void snapshot(active.tournament!.id)
      }, state => { if (live) setConnection(state) })
    }).catch(e => { if (live) setError(message(e)) })
    return () => { live = false; stop?.() }
  }, [api, attempt])
  const seconds = tournament ? Math.max(0, Math.floor((Date.parse(tournament.endsAt) - now) / 1000)) : 0
  const retry = () => { setError(''); setBoard(null); setAttempt(value => value + 1) }
  const join = async () => { if (!tournament) return; try { await api.tournament.join(tournament.id); retry() } catch (e) { setError(message(e)) } }
  return <section className="history-card tournament-card"><div className="history-title"><div><h2>{tournament?.name ?? 'Турнир'}</h2><p>{tournament ? `${tournament.status} · осталось ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Сейчас нет активного турнира'}</p></div><button className="secondary" onClick={onBack}>К игре ↗</button></div>
    {tournament && <p className={`connection ${connection === 'connected' ? 'online' : ''}`}>{connection === 'connected' ? '● Таблица обновляется в реальном времени' : '○ Восстанавливаем таблицу…'}</p>}
    {error ? <p className="error" role="alert">{error} <button onClick={retry}>Повторить</button></p> : tournament && !board ? <p className="loading" role="status">Загружаем таблицу…</p> : board ? <><h3>Топ-3</h3><div className="leaderboard">{board.top3.map(entry => <div key={entry.userId}><strong>#{entry.position} {entry.username}</strong><span>{number(entry.score)} ✧</span></div>)}</div>{board.currentPlayer ? <div className="current-player"><span>Ваше место</span><strong>#{board.currentPlayer.position} · {board.currentPlayer.username}</strong><b>{number(board.currentPlayer.score)} ✧</b></div> : <button className="primary" onClick={() => void join()}>Участвовать в турнире ↗</button>}<p className="muted">Участников: {number(board.totalParticipants)} · revision {board.tournament.revision}</p></> : null}
  </section>
}

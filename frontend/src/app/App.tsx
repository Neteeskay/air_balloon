import { useEffect, useState, type FormEvent } from 'react'
import { api as defaultApi } from '../api'
import type { Api, User } from '../api/types'
import { message } from '../game/session'
import { GameHome } from './GameHome'

export default function App({ api = defaultApi }: { api?: Api }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; api.auth.currentUser().then(u => { if (active) setUser(u) }).catch(e => { if (active) setError(message(e)) }).finally(() => { if (active) setLoading(false) }); return () => { active = false } }, [api])
  if (loading) return <main className="boot" role="status">Готовим ваш полёт…</main>
  if (user) return <GameHome key={user.id} user={user} api={api} onLogout={async () => { await api.auth.logout(); setUser(null) }} />
  return <Login api={api} onLogin={setUser} initialError={error} />
}
function Login({ api, onLogin, initialError }: { api: Api; onLogin: (u: User) => void; initialError: string }) {
  const [login, setLogin] = useState(''); const [password, setPassword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState(initialError); const [busy, setBusy] = useState(false)
  const signIn = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('')
    try { onLogin(await api.auth.login(login, password)) } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  return <main className="login-sky">
    <div className="login-intro"><span className="eyebrow">БОНУСЫ СТАНОВЯТСЯ ПРИКЛЮЧЕНИЕМ</span><h1>Выше облаков.<br /><em>Ближе к победе.</em></h1><p>Выберите свой шар, поймайте момент<br />и заберите бонусы до падения.</p><div className="intro-balloon" aria-hidden="true"><Balloon /></div><span className="login-caption">ВОЗДУШНЫЙ ШАР / FLIGHT CLUB</span></div>
    <section className="login-card"><Brand /><div className="heading"><h2>Войти в игру</h2><p>Ваш следующий полёт начинается здесь.</p></div>
      {api.mode === 'real' && <p className="info">REAL API: вход ожидает CORE-интеграции. Клиентские демо-пароли не отправляются на сервер.</p>}
      <form onSubmit={signIn}><label>Логин<input value={login} onChange={e => setLogin(e.target.value)} placeholder="Например, anna" autoComplete="username" required /></label><label>Пароль<input value={password} onChange={e => setPassword(e.target.value)} placeholder="Введите пароль" type="password" autoComplete="current-password" required /></label>{error && <p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy} type="submit">{busy ? 'Входим…' : 'Войти'} <span aria-hidden="true">↗</span></button></form>
      {api.auth.demos.length > 0 && <><div className="demo-heading">Или выберите тестовый профиль</div><div className="profiles">{api.auth.demos.map(demo => <button className={`profile ${selectedId === demo.id ? 'chosen' : ''}`} key={demo.id} onClick={() => { setSelectedId(demo.id); setLogin(demo.login); setPassword(demo.password); setError('') }}><span className="avatar" style={{ backgroundColor: demo.color }}>{demo.initials}</span><span><strong>{demo.name}</strong><small>{demo.login} · {demo.password}</small></span><b>↗</b></button>)}</div><p className="hint">Стартовый баланс каждого профиля — 5 000 бонусов.<br />Прогресс демо сохраняется в этом браузере.</p></>}
    </section>
  </main>
}
export function Brand() { return <div className="brand"><span aria-hidden="true">◈</span><div>ВОЗДУШНЫЙ ШАР<small>FLIGHT CLUB</small></div></div> }
export function Balloon() { return <div className="balloon-art"><div className="balloon-envelope"><i /><i /><i /></div><div className="balloon-ropes" /><div className="balloon-basket" /></div> }

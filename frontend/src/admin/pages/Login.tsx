import { useState, type FormEvent } from 'react'
import type { AdminSession } from '../client'
import { AdminClient } from '../client'

export function Login({ client, onSession }: { client: AdminClient; onSession: (session: AdminSession) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const signIn = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try { onSession(await client.login({ username: username.trim(), password })) }
    catch (e) { setError((e as Error).message) }
    finally { setBusy(false) }
  }
  return <div className="admin-login">
    <form className="admin-login-card" onSubmit={signIn}>
      <div className="admin-login-logo" aria-hidden="true">◈</div>
      <h1>Администрирование</h1>
      <p className="admin-login-subtitle">Управление игровой конфигурацией «Воздушный шар».</p>
      <label>Логин<input value={username} onChange={e => setUsername(e.target.value)} placeholder="admin" autoComplete="username" required /></label>
      <label>Пароль<input value={password} onChange={e => setPassword(e.target.value)} placeholder="Пароль администратора" type="password" autoComplete="current-password" required /></label>
      {error && <p role="alert" className="admin-error">{error}</p>}
      <button className="admin-primary" disabled={busy} type="submit">{busy ? 'Входим…' : 'Войти'}</button>
      <button type="button" className="admin-link-button" onClick={() => { location.hash = '#/' }}>← К игре</button>
    </form>
  </div>
}
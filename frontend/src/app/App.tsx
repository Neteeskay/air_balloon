import { FormEvent, type CSSProperties, useEffect, useState } from 'react'

type DemoUser = {
  id: string
  name: string
  login: string
  password: string
  initials: string
  color: string
  bonusBalance: number
}

type AuthenticatedUser = {
  userId: string
  username: string
  displayName: string
  bonusBalance: number
  gameScore: number
}

const demoUsers: DemoUser[] = [
  { id: 'anna', name: 'Анна Ветрова', login: 'anna', password: 'balloon1', initials: 'АВ', color: '#fb5c55', bonusBalance: 5000 },
  { id: 'maks', name: 'Максим Орлов', login: 'maks', password: 'balloon2', initials: 'МО', color: '#4a9bff', bonusBalance: 5000 },
  { id: 'liza', name: 'Лиза Соколова', login: 'liza', password: 'balloon3', initials: 'ЛС', color: '#58bf83', bonusBalance: 5000 },
]

function App() {
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [user, setUser] = useState<AuthenticatedUser | null>(null)

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((profile) => { if (profile) setUser(profile) })
      .catch(() => undefined)
  }, [])

  const chooseDemo = (demo: DemoUser) => {
    setSelectedId(demo.id)
    setLogin(demo.login)
    setPassword(demo.password)
    setError('')
  }

  const signIn = async (event: FormEvent) => {
    event.preventDefault()
    const response = await fetch('/api/auth/demo-login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: login.trim(), password }),
    }).catch(() => null)
    if (!response?.ok) {
      setError('Проверьте логин и пароль или выберите демо-профиль ниже.')
      return
    }
    setUser(await response.json())
    setError('')
  }

  const signOut = async () => {
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' }).catch(() => undefined)
    setUser(null)
    setSelectedId(null)
    setLogin('')
    setPassword('')
  }

  if (user) {
    return (
      <main className="game-shell">
        <section className="game-placeholder">
          <div className="game-brand"><div className="balloon compact-balloon" aria-hidden="true"><span /></div><span>ВОЗДУШНЫЙ ШАР</span></div>
          <div className="game-ready">
            <p className="eyebrow">Вы вошли в игру</p>
            <h1>Готовы к полёту?</h1>
            <p>Выберите тему и ставку, когда игровой экран будет подключён.</p>
            <button className="primary" type="button">Перейти к выбору ставки</button>
          </div>
          <div className="game-horizon" />
        </section>
        <aside className="profile-panel" aria-label="Профиль пользователя">
          <div className="profile-panel__top"><span>ПРОФИЛЬ</span><button className="logout" type="button" onClick={signOut}>Выйти</button></div>
          <div className="profile-photo" style={{ '--profile-color': demoUsers.find((item) => item.login === user.username)?.color ?? '#4a9bff' } as CSSProperties} aria-label="Заглушка фотографии профиля">
            <span>{demoUsers.find((item) => item.login === user.username)?.initials ?? user.displayName.slice(0, 2)}</span>
          </div>
          <div className="profile-name"><h2>{user.displayName}</h2><p>@{user.username}</p></div>
          <div className="profile-balance"><span>Бонусный баланс</span><strong>{user.bonusBalance.toLocaleString('ru-RU')}</strong><small>бонусов</small></div>
          <div className="profile-note"><span className="status-dot" />Тестовый профиль</div>
        </aside>
      </main>
    )
  }

  return (
    <main className="sky">
      <div className="sun" /><div className="cloud cloud-one" /><div className="cloud cloud-two" /><div className="cloud cloud-three" />
      <section className="login-card">
        <div className="brand"><div className="balloon" aria-hidden="true"><span /></div><div><p>БОНУСНАЯ ИГРА</p><h1>Воздушный<br />Шар</h1></div></div>
        <div className="heading"><h2>Войти в игру</h2><p>Выберите тестовый профиль или введите данные вручную.</p></div>
        <form onSubmit={signIn}>
          <label>Логин<input value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Например, anna" autoComplete="username" /></label>
          <label>Пароль<input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Введите пароль" type="password" autoComplete="current-password" /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="primary" type="submit">Войти</button>
        </form>
        <div className="demo-heading"><span />Тестовые профили<span /></div>
        <div className="profiles">
          {demoUsers.map((demo) => <button className={`profile ${selectedId === demo.id ? 'chosen' : ''}`} type="button" key={demo.id} onClick={() => chooseDemo(demo)}>
            <div className="avatar" style={{ backgroundColor: demo.color }}>{demo.initials}</div>
            <span><strong>{demo.name}</strong><small>{demo.login} · {demo.password}</small></span><b>5 000</b>
          </button>)}
        </div>
        <p className="hint">У каждого профиля — 5&nbsp;000 бонусных баллов для тестирования.</p>
      </section>
    </main>
  )
}

export default App

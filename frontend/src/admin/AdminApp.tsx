import { useCallback, useEffect, useState } from 'react'
import type { ConfigMetadata } from './types'
import { AdminClient, adminClient, adminSession, clearAdminSession } from './client'
import { Audit } from './pages/Audit'
import { ConfigEditor } from './pages/ConfigEditor'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { Versions } from './pages/Versions'

export type AdminPage = 'overview' | 'config' | 'versions' | 'audit'

export default function AdminApp({ client = adminClient }: { client?: AdminClient }) {
  const [session, setSession] = useState(() => adminSession())
  const [page, setPage] = useState<AdminPage>('overview')
  const [metadata, setMetadata] = useState<ConfigMetadata | null>(null)
  const [apiError, setApiError] = useState('')
  const load = useCallback(() => {
    client.getMetadata()
      .then(meta => setMetadata(meta))
      .catch(e => setApiError((e as Error).message))
  }, [client])
  useEffect(() => { if (session) load() }, [session, load])
  const logout = async () => {
    try { await client.logout() } catch { /* best-effort */ }
    clearAdminSession(); setSession(null)
  }
  if (!session) return <Login client={client} onSession={setSession} />
  return <div className="admin">
    <header className="admin-topbar">
      <div className="admin-brand"><span aria-hidden="true">◈</span><span>Админ</span></div>
      <nav aria-label="Админ-навигация">
        <button aria-current={page === 'overview' ? 'page' : undefined} onClick={() => setPage('overview')}>Обзор</button>
        <button aria-current={page === 'config' ? 'page' : undefined} onClick={() => setPage('config')}>Конфигурация</button>
        <button aria-current={page === 'versions' ? 'page' : undefined} onClick={() => setPage('versions')}>Версии</button>
        <button aria-current={page === 'audit' ? 'page' : undefined} onClick={() => setPage('audit')}>Аудит</button>
      </nav>
      <div className="admin-topbar-actions">
        <button className="admin-link-button" onClick={() => { location.hash = '#/' }}>К игре</button>
        <button className="admin-link-button" onClick={() => void logout()}>Выйти</button>
      </div>
    </header>
    <main className="admin-main">
      {apiError && <div role="alert" className="admin-error admin-mb-16">{apiError} <button className="admin-link-button" onClick={() => setApiError('')}>Закрыть</button></div>}
      {page === 'overview' && <Overview client={client} onNavigate={setPage} />}
      {page === 'config' && metadata && <ConfigEditor client={client} metadata={metadata} />}
      {page === 'versions' && <Versions client={client} metadata={metadata} />}
      {page === 'audit' && <Audit client={client} />}
      {page === 'config' && !metadata && !apiError && <div className="admin-loading">Загружаем метаданные…</div>}
    </main>
  </div>
}
import { useState, type FormEvent } from 'react'
import { AdminClient } from '../client'
import { actionLabel, date, shortId } from '../format'
import type { AuditEvent, PageResponse } from '../types'
import { ADMIN_ACTIONS } from '../types'
import { useEffect, useCallback } from 'react'

export function Audit({ client }: { client: AdminClient }) {
  const [action, setAction] = useState('')
  const [administrator, setAdministrator] = useState('')
  const [version, setVersion] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [pageData, setPageData] = useState<PageResponse<AuditEvent> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback((page: number) => {
    client.audit({
        action: action || undefined,
        administrator: administrator.trim() || undefined,
        version: version.trim() || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        page, size: 50,
      })
      .then(data => { setPageData(data); setError('') })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [client, action, administrator, version, from, to])
  useEffect(() => { load(0) }, [load])
  const submit = (event: FormEvent) => { event.preventDefault(); void load(0) }
  const reset = () => { setAction(''); setAdministrator(''); setVersion(''); setFrom(''); setTo(''); }
  return <div>
    <div className="admin-page-head"><div><p className="admin-eyebrow">ЖУРНАЛ ДЕЙСТВИЙ</p><h1>Аудит</h1></div></div>
    {error && <div role="alert" className="admin-error admin-mb-16">{error}</div>}
    <section className="admin-card admin-mb-16">
      <form className="admin-filter-grid" onSubmit={submit}>
        <label className="admin-form-label"><span>Действие</span>
          <select value={action} onChange={e => setAction(e.target.value)}>
            <option value="">Все</option>
            {ADMIN_ACTIONS.map(a => <option key={a} value={a}>{actionLabel(a)}</option>)}
          </select></label>
        <label className="admin-form-label"><span>Администратор</span>
          <input value={administrator} onChange={e => setAdministrator(e.target.value)} placeholder="admin" /></label>
        <label className="admin-form-label"><span>Версия (ID)</span>
          <input value={version} onChange={e => setVersion(e.target.value)} placeholder="UUID версии" /></label>
        <label className="admin-form-label"><span>С</span>
          <input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label className="admin-form-label"><span>По</span>
          <input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} /></label>
        <div className="admin-filter-actions">
          <button className="admin-primary admin-primary-compact" type="submit" disabled={loading}>{loading ? 'Ищем…' : 'Применить'}</button>
          <button className="admin-secondary" type="button" onClick={() => { reset(); void load(0) }}>Сбросить</button>
        </div>
      </form>
    </section>
    {loading && !pageData && <div className="admin-loading">Поиск в журнале…</div>}
    {pageData && <section className="admin-card">
      <p className="admin-hint">Найдено записей: {pageData.totalElements}.</p>
      <table className="admin-table">
        <thead><tr><th>Когда</th><th>Администратор</th><th>Действие</th><th>Объект</th><th>Версия</th><th>Trace</th></tr></thead>
        <tbody>
          {pageData.content.map(e => <tr key={e.id}>
            <td>{date(e.timestamp)}</td>
            <td>{e.administrator}</td>
            <td><span className="admin-action">{actionLabel(e.action)}</span><small className="admin-mono admin-hint"> · {e.action}</small></td>
            <td>{e.affectedEntity ?? '—'}</td>
            <td className="admin-mono">{e.configId ? shortId(e.configId) : '—'}</td>
            <td className="admin-mono">{e.traceId && shortId(e.traceId)}</td>
          </tr>)}
        </tbody>
      </table>
      {pageData.content.length === 0 && <p className="admin-hint admin-p-16">Записей, удовлетворяющих фильтру, нет.</p>}
      <div className="admin-pagination">
        <button className="admin-secondary" disabled={pageData.page <= 0 || loading} onClick={() => void load(pageData.page - 1)}>← Назад</button>
        <span className="admin-hint">Страница {pageData.page + 1} из {Math.max(pageData.totalPages, 1)}</span>
        <button className="admin-secondary" disabled={pageData.page + 1 >= pageData.totalPages || loading} onClick={() => void load(pageData.page + 1)}>Вперёд →</button>
      </div>
    </section>}
  </div>
}
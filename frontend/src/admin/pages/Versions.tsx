import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminApiError, AdminClient } from '../client'
import { StatusPill, Modal } from '../components'
import { date, formatValue, number } from '../format'
import { ruParam } from '../labels'
import { formParameters } from '../model'
import type { ConfigDiff, ConfigMetadata, ConfigurationVersionSummary, GameConfiguration, ParameterMetadata } from '../types'

export function Versions({ client, metadata }: { client: AdminClient; metadata: ConfigMetadata | null }) {
  const [versions, setVersions] = useState<ConfigurationVersionSummary[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<GameConfiguration | null>(null)
  const [diff, setDiff] = useState<ConfigDiff | null>(null)
  const [diffError, setDiffError] = useState('')
  const [confirmRollback, setConfirmRollback] = useState<ConfigurationVersionSummary | null>(null)
  const load = useCallback(() => {
    Promise.all([client.versions(0, 50), client.getCurrent()])
      .then(([page, current]) => {
        setVersions(page.content.filter(v => v.status !== 'DRAFT'))
        setActiveId(current.id)
        setError('')
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [client])
  useEffect(() => { load() }, [load])
  const openDetail = useCallback(async (id: string) => {
    setDetailId(id); setDetail(null); setDiff(null); setDiffError('')
    try { setDetail(await client.version(id)) }
    catch (e) { setDetailId(null); setError((e as Error).message) }
  }, [client])
  const openDiff = useCallback(async (fromId: string, toId: string | null) => {
    if (!toId) { setDiffError('Нет текущей версии для сравнения.'); return }
    setDetailId(null); setDiff(null); setDiffError('')
    try { setDiff(await client.diff(fromId, toId)) }
    catch (e) { setDiffError((e as Error).message) }
  }, [client])
  const rollback = useCallback(async () => {
    if (!confirmRollback) return
    try { await client.rollback(confirmRollback.id); setConfirmRollback(null); await load() }
    catch (e) { setError(e instanceof AdminApiError ? e.message : (e as Error).message); setConfirmRollback(null) }
  }, [client, confirmRollback, load])
  const params = useMemo(() => (metadata ? formParameters(metadata).map(ruParam) : []), [metadata])
  const byName = useMemo(() => new Map(params.map(p => [p.technicalName, p])), [params])
  if (loading) return <div className="admin-loading">Загружаем список сохранений…</div>
  return <div>
    <div className="admin-page-head"><div><p className="admin-eyebrow">ИСТОРИЯ ИЗМЕНЕНИЙ</p><h1>История</h1>
      <p className="admin-hint">Каждое сохранение создаёт новую ревизию. Из любой версии можно восстановить настройки.</p></div>
      <button className="admin-secondary" onClick={() => void load()}>Обновить</button></div>
    {error && <div role="alert" className="admin-error admin-mb-14">{error}</div>}
    <section className="admin-card">
      <table className="admin-table">
        <thead><tr><th>Ревизия</th><th>Статус</th><th>Сохранена</th><th>Автор</th><th></th></tr></thead>
        <tbody>
          {versions.map(v => <tr key={v.id}>
            <td className="admin-mono">#{v.revision}</td>
            <td><StatusPill status={v.status} /></td>
            <td>{date(v.createdAt)}</td>
            <td>{v.createdBy}</td>
            <td><div className="admin-row-actions">
              <button className="admin-link-button" onClick={() => void openDetail(v.id)} disabled={!metadata}>Подробнее</button>
              <button className="admin-link-button" onClick={() => void openDiff(v.id, activeId)} disabled={v.id === activeId || !activeId}>Сравнить с текущей</button>
              <button className="admin-link-button" onClick={() => setConfirmRollback(v)} disabled={v.status === 'ACTIVE'}>Восстановить</button>
            </div></td>
          </tr>)}
        </tbody>
      </table>
      {versions.length === 0 && <p className="admin-hint admin-p-16">История пока пуста. Измените и сохраните настройки на вкладке «Конфигурация».</p>}
    </section>
    {detailId !== null && <Modal title={detail ? `Ревизия #${detail.revision}` : 'Загрузка…'} onClose={() => setDetailId(null)}>
      {!detail && <div className="admin-loading">Загружаем…</div>}
      {detail && <>
        <dl className="admin-fields admin-fields-3">
          <div className="admin-field-row"><dt>Ревизия</dt><dd>#{detail.revision}</dd></div>
          <div className="admin-field-row"><dt>Статус</dt><dd><StatusPill status={detail.status} /></dd></div>
          <div className="admin-field-row"><dt>Сохранена</dt><dd>{date(detail.createdAt)}<small>{detail.createdBy}</small></dd></div>
        </dl>
        <div className="admin-fields admin-fields-2">
          {params.map(p => <div key={p.technicalName} className="admin-field-row" data-testid={`detail-${p.technicalName}`}>
            <dt>{p.displayName}</dt>
            <dd>{formatValue(p, getPath(detail, p.technicalName))}</dd>
          </div>)}
        </div>
      </>}
    </Modal>}
    {diff && <Modal title="Сравнение версий" onClose={() => setDiff(null)}>
      <p className="admin-hint">Изменения между ревизиями #{versions.find(v => v.id === diff.fromVersionId)?.revision ?? '?'} и #{versions.find(v => v.id === diff.toVersionId)?.revision ?? '?'}.</p>
      {diff.changes.length === 0 && <p className="admin-hint">Различий нет.</p>}
      <table className="admin-table">
        <thead><tr><th>Параметр</th><th>Было</th><th>Стало</th></tr></thead>
        <tbody>
          {diff.changes.map((c, i) => <tr key={`${c.field}-${i}`}>
            <td className="admin-mono">{c.field}<small>{labelOf(c.field, byName)}</small></td>
            <td>{fmt(c.before)}</td>
            <td><strong>{fmt(c.after)}</strong></td>
          </tr>)}
        </tbody>
      </table>
    </Modal>}
    {diffError && <Modal title="Сравнение версий" onClose={() => setDiffError('')}><p role="alert" className="admin-error">{diffError}</p></Modal>}
    {confirmRollback && <Modal title={`Восстановить ревизию #${confirmRollback.revision}?`} onClose={() => setConfirmRollback(null)}>
      <p className="admin-flex-p">Будет создана новая активная версия с настройками ревизии #${confirmRollback.revision}. Продолжить?</p>
      <div className="admin-flex-row">
        <button className="admin-primary" onClick={() => void rollback()}>Восстановить</button>
        <button className="admin-secondary" onClick={() => setConfirmRollback(null)}>Отмена</button>
      </div>
    </Modal>}
  </div>
}

const getPath = (config: GameConfiguration, technicalName: string): unknown => {
  if (technicalName === 'gameId') return config.gameId
  if (technicalName === 'gameName') return config.gameName
  if (technicalName === 'gameType') return config.gameType
  if (technicalName === 'isActive') return config.isActive
  if (technicalName.startsWith('crash.')) return config.crash[technicalName.slice(6) as keyof typeof config.crash]
  if (technicalName.startsWith('points.')) return config.points[technicalName.slice(7) as keyof typeof config.points]
  const booster = /^boosters\.(multiplierTier\dValue|green|red)\.?(.*)$/.exec(technicalName)
  if (!booster) return undefined
  const [, root, rest] = booster
  if (root && rest) return config.boosters[root as 'green' | 'red'][rest as never]
  if (root) return config.boosters[root as keyof typeof config.boosters]
  return undefined
}

const labelOf = (field: string, byName: Map<string, ParameterMetadata>) => {
  const param = byName.get(field)
  return param?.displayName ?? ''
}

const fmt = (value: unknown) => {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return number(value)
  return String(value)
}
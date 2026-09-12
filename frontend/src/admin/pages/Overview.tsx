import { useEffect, useState } from 'react'
import type { AdminPage } from '../AdminApp'
import { AdminClient } from '../client'
import { date, number, shortId } from '../format'
import type { ConfigurationVersionSummary, GameConfiguration } from '../types'
import { StatusPill } from '../components'

export function Overview({ client, onNavigate }: { client: AdminClient; onNavigate: (page: AdminPage) => void }) {
  const [current, setCurrent] = useState<GameConfiguration | null>(null)
  const [versions, setVersions] = useState<ConfigurationVersionSummary[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    Promise.all([client.getCurrent(), client.versions(0, 5)])
      .then(([config, page]) => { if (live) { setCurrent(config); setVersions(page.content) } })
      .catch(e => { if (live) setError((e as Error).message) })
    return () => { live = false }
  }, [client])
  return <div>
    <div className="admin-page-head"><div><p className="admin-eyebrow">СОСТОЯНИЕ ИГРЫ</p><h1>Обзор</h1></div>
      <button className="admin-primary admin-primary-compact" onClick={() => onNavigate('config')}>Изменить конфигурацию</button></div>
    {error && <div role="alert" className="admin-error admin-mb-16">{error}</div>}
    {!current && !error && <div className="admin-loading">Загружаем состояние…</div>}
    {current && <>
      <section className="admin-card admin-mb-16">
        <div className="admin-card-head"><h2>Текущая конфигурация</h2><StatusPill status={current.status} /></div>
        <dl className="admin-fields admin-fields-4">
          <div className="admin-field-row"><dt>Игра</dt><dd>{current.gameId} · {current.gameName}</dd></div>
          <div className="admin-field-row"><dt>Ревизия</dt><dd>#{current.revision}</dd></div>
          <div className="admin-field-row"><dt>Создана</dt><dd>{date(current.createdAt)}<small>автор: {current.createdBy}</small></dd></div>
          <div className="admin-field-row"><dt>Активирована</dt><dd>{(current.activatedAt && `${date(current.activatedAt)} · ${current.activatedBy ?? '—'}`) || 'не активирована'}</dd></div>
          <div className="admin-field-row"><dt>Alpha</dt><dd>{number(current.crash.alpha)}</dd></div>
          <div className="admin-field-row"><dt>Мин. crash</dt><dd>{current.crash.minCrashMultiplier}</dd></div>
          <div className="admin-field-row"><dt>Макс. multiplier</dt><dd>{`×${current.crash.maxMultiplier}`}</dd></div>
          <div className="admin-field-row"><dt>Очки за линию</dt><dd>{number(current.points.pointsPerLine)}</dd></div>
          <div className="admin-field-row"><dt>Бустеры</dt><dd>{[current.boosters.multiplierTier1Value, current.boosters.multiplierTier2Value, current.boosters.multiplierTier3Value, current.boosters.multiplierTier4Value].map(v => `×${v}`).join(' · ')}</dd></div>
          <div className="admin-field-row"><dt>Зелёные уровни</dt><dd>{Object.keys(current.boosters.green).length}</dd></div>
          <div className="admin-field-row"><dt>Красные уровни</dt><dd>{Object.keys(current.boosters.red).length}</dd></div>
          <div className="admin-field-row"><dt>ID версии</dt><dd className="admin-mono">{shortId(current.id)}</dd></div>
        </dl>
      </section>
      <section className="admin-card">
        <div className="admin-card-head"><h2>Последние версии</h2><button className="admin-link-button" onClick={() => onNavigate('versions')}>Все версии →</button></div>
        <table className="admin-table">
          <thead><tr><th>Ревизия</th><th>Статус</th><th>Создана</th><th>Автор</th><th>Основание</th></tr></thead>
          <tbody>
            {versions.map(v => <tr key={v.id}>
              <td className="admin-mono">#{v.revision}</td>
              <td><StatusPill status={v.status} /></td>
              <td>{date(v.createdAt)}</td>
              <td>{v.createdBy}</td>
              <td>{v.baseRevision ? `#${v.baseRevision}` : '—'}</td>
            </tr>)}
          </tbody>
        </table>
      </section>
    </>}
  </div>
}
import { useEffect, useState } from 'react'
import type { AdminPage } from '../AdminApp'
import { AdminClient } from '../client'
import { date, number } from '../format'
import type { ConfigurationVersionSummary, GameConfiguration } from '../types'
import { StatusPill } from '../components'

export function Overview({ client, onNavigate }: { client: AdminClient; onNavigate: (page: AdminPage) => void }) {
  const [current, setCurrent] = useState<GameConfiguration | null>(null)
  const [versions, setVersions] = useState<ConfigurationVersionSummary[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let live = true
    Promise.all([client.getCurrent(), client.versions(0, 5)])
      .then(([config, page]) => { if (live) { setCurrent(config); setVersions(page.content.filter(v => v.status !== 'DRAFT')) } })
      .catch(e => { if (live) setError((e as Error).message) })
    return () => { live = false }
  }, [client])
  return <div>
    <div className="admin-page-head"><div><p className="admin-eyebrow">СОСТОЯНИЕ ИГРЫ</p><h1>Обзор</h1></div>
      <button className="admin-primary admin-primary-compact" onClick={() => onNavigate('config')}>Настройка игры</button></div>
    {error && <div role="alert" className="admin-error admin-mb-14">{error}</div>}
    {!current && !error && <div className="admin-loading">Загружаем состояние…</div>}
    {current && <>
      <div className="admin-overview-grid">
        <section className="admin-card">
          <div className="admin-card-head">
            <h2 className="admin-card-title">{current.gameName}</h2>
            <div className="admin-head-badges">
              <StatusPill status={current.status} />
              <span className="admin-pill">ревизия #{current.revision}</span>
            </div>
          </div>
          <div className="admin-state-line">
            <span className={`admin-state-badge ${current.isActive ? 'on' : 'off'}`}>{current.isActive ? 'Игра работает' : 'Игра остановлена'}</span>
            <small>{current.isActive ? 'новые раунды принимаются' : 'новые раунды не принимаются'}</small>
          </div>
          <div className="admin-kpis">
            <div className="admin-kpi"><span>Наклон кривой (α)</span><strong>{number(current.crash.alpha)}</strong><small>чем выше, тем реже крупные выигрыши</small></div>
            <div className="admin-kpi"><span>Максимальный множитель</span><strong>×{number(current.crash.maxMultiplier)}</strong><small>потолок выигрыша</small></div>
            <div className="admin-kpi"><span>Экспоненциальный рост</span><strong>{number(current.crash.multiplierGrowthRate)}/сек</strong><small>константа роста flight X</small></div>
            <div className="admin-kpi"><span>Очки за линию</span><strong>{number(current.points.pointsPerLine)}</strong><small>базовая награда игрока</small></div>
          </div>
          <div className="admin-fields admin-fields-3 admin-mt-14">
            <div className="admin-field-row"><dt>Бустеры</dt><dd>×{current.boosters.multiplierTier1Value} · ×{current.boosters.multiplierTier2Value} · ×{current.boosters.multiplierTier3Value} · ×{current.boosters.multiplierTier4Value}</dd></div>
            <div className="admin-field-row"><dt>Зелёная тема</dt><dd>{Object.keys(current.boosters.green).length} линий</dd></div>
            <div className="admin-field-row"><dt>Красная тема</dt><dd>{Object.keys(current.boosters.red).length} линий</dd></div>
          </div>
        </section>
        <section className="admin-card">
          <h2 className="admin-card-title">Как устроена игра</h2>
          <ul className="admin-about">
            <li><b>Шар летит вверх</b> — множитель растёт. Пока он летит, игрок может вывести выигрыш.</li>
            <li><b>Крах.</b> Если не вывел вовремя — шар лопается, выигрыш сгорает.</li>
            <li><b>Наклон кривой (α)</b> — параметр формы распределения крашей. Чем α выше, тем сильнее кривая смещена к низким множителям и реже крупные выигрыши.</li>
            <li><b>Бустеры ×2 / ×3 / ×4</b> повышают отображаемый X и выплату, но не физическую скорость шара и не crash point.</li>
            <li><b>Очки</b> даются за пройденные линии, вывод выигрыша и бустеры.</li>
          </ul>
        </section>
      </div>
      <section className="admin-card">
        <div className="admin-card-head"><h2 className="admin-card-title">Последние сохранения</h2><button className="admin-link-button" onClick={() => onNavigate('versions')}>Вся история →</button></div>
        <div className="admin-table-wrap"><table className="admin-table">
          <thead><tr><th>Ревизия</th><th>Статус</th><th>Сохранена</th><th>Автор</th></tr></thead>
          <tbody>
            {versions.map(v => <tr key={v.id}>
              <td className="admin-mono">#{v.revision}</td>
              <td><StatusPill status={v.status} /></td>
              <td>{date(v.createdAt)}</td>
              <td>{v.createdBy}</td>
            </tr>)}
          </tbody>
        </table></div>
      </section>
    </>}
  </div>
}

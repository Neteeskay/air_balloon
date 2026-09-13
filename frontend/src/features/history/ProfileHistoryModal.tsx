import { BarChart3, Crown, Info, List, Trophy, XCircle } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Modal } from '../../components/ui/Modal'
import { api as defaultApi } from '../../api'
import type { Api, HistoryItem, HistoryPage } from '../../api/types'
import './profile-history.css'

type HistoryFilter = 'all' | 'RED' | 'GREEN'

type ProfileHistoryModalProps = {
  api?: Api
  onClose: () => void
}

const PAGE_SIZE = 50

function coefficient(item: HistoryItem) {
  const value = Number(item.cashoutMultiplier ?? item.crashMultiplier)
  return Number.isFinite(value) ? value : 0
}

function formatCoefficient(value: number) {
  return `×${value.toFixed(2)}`
}

function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('ru-RU')
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

function playerName(item: HistoryItem) {
  return item.displayName?.trim() || item.username?.trim() || 'Игрок'
}

function playerInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2)).toUpperCase()
}

function avatarHue(name: string) {
  const hash = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0)
  return 185 + (hash % 115)
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Не удалось загрузить историю игр.'
}

export function ProfileHistoryModal({ api = defaultApi, onClose }: ProfileHistoryModalProps) {
  const [history, setHistory] = useState<HistoryPage | null>(null)
  const [filter, setFilter] = useState<HistoryFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const next = await api.history.getGlobalHistory(0, PAGE_SIZE)
      setHistory(next)
      setError('')
    } catch (reason) {
      setError(errorText(reason))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => { void load(true) }, 15_000)
    return () => window.clearInterval(timer)
  }, [attempt, load])

  const items = useMemo(() => {
    const source = history?.items ?? []
    return filter === 'all' ? source : source.filter((item) => item.theme === filter)
  }, [filter, history])
  const latestCoefficient = items.length ? coefficient(items[0]) : 0
  const maximumCoefficient = items.reduce((maximum, item) => Math.max(maximum, coefficient(item)), 0)
  const updatedLabel = history?.serverTime ? formatTime(history.serverTime) : ''

  return (
    <Modal
      className="av-history-modal"
      onClose={onClose}
      title={(
        <span className="av-history-title">
          <img src="/assets/flight-mode/balloon-red.png" alt="" />
          <span><strong>История игр</strong><small>Последние завершённые раунды всех игроков</small></span>
        </span>
      )}
    >
      <div className="av-history-status" role="status">
        <i aria-hidden="true" />
        <span>Обновляется автоматически{updatedLabel ? ` · ${updatedLabel}` : ''}</span>
      </div>

      <div className="av-history-metrics" aria-label="Сводка истории">
        <article>
          <span className="av-history-metric-icon av-history-metric-icon--blue"><BarChart3 aria-hidden="true" /></span>
          <span><small>Последний коэффициент</small><strong>{latestCoefficient ? formatCoefficient(latestCoefficient) : '—'}</strong></span>
        </article>
        <article>
          <span className="av-history-metric-icon av-history-metric-icon--gold"><Crown aria-hidden="true" /></span>
          <span><small>Максимум за последние игры</small><strong>{maximumCoefficient ? formatCoefficient(maximumCoefficient) : '—'}</strong></span>
        </article>
        <article>
          <span className="av-history-metric-icon av-history-metric-icon--gray"><List aria-hidden="true" /></span>
          <span><small>Показано</small><strong>{formatNumber(items.length)} раундов</strong></span>
        </article>
      </div>

      <div className="av-history-filters">
        <div className="av-history-tabs" role="tablist" aria-label="Фильтр истории">
          {([['all', 'Все'], ['RED', 'Красный'], ['GREEN', 'Зелёный']] as const).map(([value, label]) => (
            <button
              aria-selected={filter === value}
              className={filter === value ? 'is-active' : ''}
              key={value}
              onClick={() => setFilter(value)}
              role="tab"
              type="button"
            >
              {value !== 'all' && <i className={`av-history-dot av-history-dot--${value.toLowerCase()}`} aria-hidden="true" />}
              {label}
            </button>
          ))}
        </div>
        <p><Info aria-hidden="true" size={19} />Новые завершённые раунды появляются автоматически</p>
      </div>

      {error && !history ? (
        <div className="av-history-state" role="alert"><p>{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Повторить</button></div>
      ) : loading && !history ? (
        <p className="av-history-state" role="status">Загружаем историю…</p>
      ) : items.length === 0 ? (
        <div className="av-history-state"><p>В выбранном режиме пока нет завершённых раундов.</p></div>
      ) : (
        <section className="av-history-table" aria-label="Завершённые раунды">
          <div className="av-history-table-heading" aria-hidden="true"><span>Время</span><span>Игрок</span><span>Режим</span><span>Коэффициент</span><span>Результат</span></div>
          <div className="av-history-scroll">
            {items.map((item) => {
              const name = playerName(item)
              const value = coefficient(item)
              const isWin = item.result === 'WIN'
              return <article className="av-history-row" data-round-id={item.roundId} key={item.roundId}>
                <time dateTime={item.completedAt} title={formatDate(item.completedAt)}>{formatTime(item.completedAt)}</time>
                <div className="av-history-player"><span className="av-history-avatar" style={{ '--avatar-hue': avatarHue(name) } as CSSProperties}>{playerInitials(name)}</span><strong>{name}</strong></div>
                <div className="av-history-mode"><i className={`av-history-dot av-history-dot--${item.theme.toLowerCase()}`} aria-hidden="true" /><span>{item.theme === 'RED' ? 'Красный' : 'Зелёный'}</span></div>
                <strong className={`av-history-coefficient ${item.theme === 'RED' ? 'is-red' : 'is-green'}`}>{formatCoefficient(value)}{value === maximumCoefficient && value > 0 && <Crown aria-label="Максимум" size={18} />}</strong>
                <div className={`av-history-result ${isWin ? 'is-win' : 'is-loss'}`}><span>{isWin ? <Trophy aria-hidden="true" size={18} /> : <XCircle aria-hidden="true" size={18} />}{isWin ? 'Забрал' : 'Crash'}</span>{isWin && <small>+{formatNumber(item.winAmount)}</small>}</div>
              </article>
            })}
          </div>
        </section>
      )}
    </Modal>
  )
}

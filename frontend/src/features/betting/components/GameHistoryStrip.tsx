import { useEffect, useMemo, useState } from 'react'
import { api as defaultApi } from '../../../api'
import type { Api, HistoryItem, User } from '../../../api/types'

const HISTORY_SIZE = 10
const REFRESH_INTERVAL_MS = 15_000

function coefficient(item: HistoryItem) {
  return Number(item.cashoutMultiplier ?? item.crashMultiplier)
}

export function GameHistoryStrip({ api = defaultApi, currentUser }: { api?: Api; currentUser?: User | null }) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const history = await api.history.getGlobalHistory(0, HISTORY_SIZE)
        if (!live) return
        setItems(history.items)
        setError('')
      } catch (reason) {
        if (!live) return
        setError(reason instanceof Error ? reason.message : 'Не удалось обновить прошлые игры.')
      } finally {
        if (live) setLoading(false)
      }
    }

    void load()
    const timer = window.setInterval(load, REFRESH_INTERVAL_MS)
    return () => {
      live = false
      window.clearInterval(timer)
    }
  }, [api])

  const results = useMemo(() => items
    .slice()
    .reverse()
    .map((item) => ({
      id: item.roundId,
      value: coefficient(item),
      isCurrentPlayer: Boolean(currentUser && (
        item.displayName?.trim() === currentUser.name.trim()
        || item.username?.trim() === currentUser.login.trim()
      )),
    }))
    .filter((item) => Number.isFinite(item.value)), [currentUser, items])

  return (
    <section className="history" aria-label="Прошлые игры">
      <span>Прошлые игры</span>
      <div className="history-list" aria-busy={loading} aria-live="polite">
        {results.map((result) => (
          <span className={[result.value >= 2 ? 'is-high' : '', result.isCurrentPlayer ? 'is-current-player' : ''].filter(Boolean).join(' ')} key={result.id}>
            {result.value.toFixed(2)}
          </span>
        ))}
      </div>
      {error && <span className="visually-hidden" role="status">{error}</span>}
    </section>
  )
}

import { useCallback, useEffect, useState } from 'react'
import type { Api, GlobalRating } from '../../api/types'

export function useGlobalRating(api: Api, page = 0, size = 50) {
  const [data, setData] = useState<GlobalRating | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError('')
    api.rating.get(page, size)
      .then((value) => { if (live) setData(value) })
      .catch((reason) => {
        if (!live) return
        setData(null)
        setError(reason instanceof Error ? reason.message : 'Не удалось загрузить рейтинг')
      })
      .finally(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [api, attempt, page, size])

  const retry = useCallback(() => {
    setData(null)
    setError('')
    setLoading(true)
    setAttempt((value) => value + 1)
  }, [])

  return { data, error, loading, retry }
}

import { useEffect, useState } from 'react'
import type { CrashRoundStatus } from '../hooks/useCrashRound'
import { CRASH_TIMING } from '../mocks/crashRound'

type CrashResultOverlayProps = {
  cashoutPayout: number
  status: CrashRoundStatus
}

export function CrashResultOverlay({ cashoutPayout, status }: CrashResultOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (status !== 'crashed') {
      setVisible(false)
      return
    }

    const timer = window.setTimeout(() => setVisible(true), CRASH_TIMING.resultDelayMs)
    return () => window.clearTimeout(timer)
  }, [status])

  if (!visible) return null

  const won = cashoutPayout > 0

  return (
    <div className={`crash-result ${won ? 'is-win' : 'is-loss'}`} role="status">
      <strong>{won ? `Вы забрали ${cashoutPayout}` : 'Шар лопнул!'}</strong>
      <span>{won ? 'Возвращаемся к выбору ставки…' : 'Ставка сгорела'}</span>
    </div>
  )
}


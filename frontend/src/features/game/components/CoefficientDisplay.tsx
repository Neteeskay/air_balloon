import { CoinIcon } from '../../betting/components/CoinIcon'
import type { CrashRoundStatus } from '../hooks/useCrashRound'

type CoefficientDisplayProps = {
  bet: number
  coefficient: number
  level: number
  status: CrashRoundStatus
}

export function CoefficientDisplay({ bet, coefficient, level, status }: CoefficientDisplayProps) {
  const styleLevel = level >= 3 ? 3 : level

  return (
    <section className={`crash-coefficient crash-coefficient--level-${styleLevel}`} aria-live="polite">
      <strong data-testid="multiplier">×{coefficient.toFixed(2)}</strong>
      <div className="crash-bet-chip">
        <span>{bet}</span>
        <CoinIcon />
      </div>
      <small>{status === 'cashed-out' ? 'Выигрыш зафиксирован' : 'Выигрыш растёт'}</small>
    </section>
  )
}

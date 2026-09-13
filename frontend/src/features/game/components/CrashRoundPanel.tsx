import { Trophy } from 'lucide-react'
import { CoinIcon } from '../../betting/components/CoinIcon'
import type { CrashRoundStatus } from '../hooks/useCrashRound'
import { CashoutButton } from './CashoutButton'
import { CashoutHintOnboarding } from './CashoutHintOnboarding'

type CrashRoundPanelProps = {
  canCashout: boolean
  cashoutPayout: number
  onCashout: () => void
  points: number
  potentialPayout: number
  showCashoutHint: boolean
  status: CrashRoundStatus
}

export function CrashRoundPanel({
  canCashout,
  cashoutPayout,
  onCashout,
  points,
  potentialPayout,
  showCashoutHint,
  status,
}: CrashRoundPanelProps) {
  const hasCashedOut = cashoutPayout > 0
  const shownPayout = hasCashedOut ? cashoutPayout : potentialPayout

  return (
    <section className="crash-round-panel" aria-label="Выигрыш и действия" data-testid="cashout-panel">
      {!hasCashedOut && status !== 'crashed' && <CashoutHintOnboarding show={showCashoutHint} />}
      <div className="crash-round-panel__numbers">
        <b>Выигрыш:</b>
        <span><strong>{shownPayout}</strong><CoinIcon /></span>
        <span><strong>{points}</strong><Trophy aria-hidden="true" /></span>
      </div>
      <span className="crash-round-panel__divider" />
      <CashoutButton
        disabled={!canCashout}
        hasCashedOut={hasCashedOut}
        onClick={onCashout}
      />
    </section>
  )
}

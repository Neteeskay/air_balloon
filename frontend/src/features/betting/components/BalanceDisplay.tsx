import { Plus } from 'lucide-react'
import { CoinIcon } from './CoinIcon'

type BalanceDisplayProps = {
  balance: number
  onTopUp: () => void
}

export function BalanceDisplay({ balance, onTopUp }: BalanceDisplayProps) {
  return (
    <div className="balance" aria-label={`Баланс ${balance} бонусов`}>
      <CoinIcon className="coin--large" />
      <strong>{balance}</strong>
      <button aria-label="Пополнить баланс" onClick={onTopUp} type="button">
        <Plus size={20} strokeWidth={3} />
      </button>
    </div>
  )
}

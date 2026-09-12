type CashoutButtonProps = {
  disabled: boolean
  hasCashedOut: boolean
  onClick: () => void
}

export function CashoutButton({ disabled, hasCashedOut, onClick }: CashoutButtonProps) {
  return (
    <button
      className="cashout-button"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {hasCashedOut ? 'ЗАБРАНО' : 'ЗАБРАТЬ'}
    </button>
  )
}

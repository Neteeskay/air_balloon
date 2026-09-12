import { ArrowRight } from 'lucide-react'

type StartButtonProps = {
  disabled: boolean
  onClick: () => void
}

export function StartButton({ disabled, onClick }: StartButtonProps) {
  return (
    <button className="start-button" disabled={disabled} onClick={onClick} type="button">
      Начать <ArrowRight size={29} strokeWidth={2.6} />
    </button>
  )
}

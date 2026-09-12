import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'

type CashoutHintOnboardingProps = {
  show: boolean
}

export function CashoutHintOnboarding({ show }: CashoutHintOnboardingProps) {
  const [visible, setVisible] = useState(show)

  useEffect(() => {
    if (!visible) return

    const timer = window.setTimeout(() => setVisible(false), 4000)
    return () => window.clearTimeout(timer)
  }, [visible])

  if (!visible) return null

  return (
    <div className="cashout-onboarding" role="status">
      <img
        alt="Нажми «Забрать» до того, как шар лопнет"
        src="/assets/hints/cashout-hint.png"
      />
      <ChevronDown aria-hidden="true" className="cashout-onboarding__arrow" />
    </div>
  )
}

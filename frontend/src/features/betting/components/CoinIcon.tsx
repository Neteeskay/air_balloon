type CoinIconProps = {
  className?: string
}

export function CoinIcon({ className = '' }: CoinIconProps) {
  return <img aria-hidden="true" className={`coin ${className}`} src="/assets/icons/coin.png" />
}

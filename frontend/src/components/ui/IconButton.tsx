import type { ReactNode } from 'react'

type IconButtonProps = {
  label: string
  children: ReactNode
  onClick?: () => void
  pressed?: boolean
}

export function IconButton({ label, children, onClick, pressed }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      aria-pressed={pressed}
      className="icon-button"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )
}

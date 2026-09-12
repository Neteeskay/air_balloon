import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

type TooltipProps = {
  children: ReactNode
  className?: string
  content: ReactNode
  forceOpen?: boolean
}

export function Tooltip({ children, className = '', content, forceOpen = false }: TooltipProps) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (forceOpen) setOpen(false)
  }, [forceOpen])

  useEffect(() => {
    if (!open || forceOpen) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [forceOpen, open])

  const visible = forceOpen || open

  return (
    <span
      aria-describedby={visible ? tooltipId : undefined}
      className={`tooltip-anchor${className ? ` ${className}` : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onFocus={() => {
        if (!forceOpen) setOpen(true)
      }}
      onMouseEnter={() => {
        if (!forceOpen) setOpen(true)
      }}
      onMouseLeave={() => setOpen(false)}
      onPointerDown={(event) => {
        if (!forceOpen && event.pointerType === 'touch') setOpen((current) => !current)
      }}
      ref={anchorRef}
    >
      {children}
      <span className={`tooltip-bubble${visible ? ' is-visible' : ''}`} id={tooltipId} role="tooltip">
        {content}
      </span>
    </span>
  )
}

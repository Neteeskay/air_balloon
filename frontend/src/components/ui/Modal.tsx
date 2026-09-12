import { useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { IconButton } from './IconButton'

type ModalProps = {
  title: ReactNode
  beforeTitle?: ReactNode
  onClose: () => void
  children: ReactNode
  className?: string
  closeOnSwipeDown?: boolean
}

export function Modal({
  title,
  beforeTitle,
  onClose,
  children,
  className = '',
  closeOnSwipeDown = false,
}: ModalProps) {
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const modalRef = useRef<HTMLElement>(null)

  return (
    <div className="modal-backdrop" onMouseDown={onClose} role="presentation">
      <section
        aria-labelledby="modal-title"
        aria-modal="true"
        className={`modal${className ? ` ${className}` : ''}`}
        onMouseDown={(event) => event.stopPropagation()}
        onTouchEnd={(event) => {
          const start = swipeStartRef.current
          swipeStartRef.current = null
          if (!closeOnSwipeDown || !start) return

          const touch = event.changedTouches[0]
          const deltaX = touch.clientX - start.x
          const deltaY = touch.clientY - start.y
          if (deltaY > 72 && deltaY > Math.abs(deltaX) * 1.2) onClose()
        }}
        onTouchStart={(event) => {
          if (!closeOnSwipeDown || (modalRef.current?.scrollTop ?? 0) > 0) return
          const touch = event.touches[0]
          swipeStartRef.current = { x: touch.clientX, y: touch.clientY }
        }}
        ref={modalRef}
        role="dialog"
      >
        {beforeTitle}
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={22} />
          </IconButton>
        </div>
        {children}
      </section>
    </div>
  )
}

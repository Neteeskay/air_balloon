import type { ReactNode } from 'react'
import { statusLabel } from './format'

export function StatusPill({ status }: { status: string }) {
  return <span className={`admin-status admin-status-${status.toLowerCase()}`}>{statusLabel(status)}</span>
}

export function Modal({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="admin-modal-title"><h2>{title}</h2><button className="admin-close" onClick={onClose} aria-label="Закрыть">✕</button></div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  )
}

export function FieldRow({ label, value, hint }: { label: string; value: unknown; hint?: string }) {
  return (
    <div className="admin-field-row">
      <dt>{label}</dt>
      <dd>{value === null || value === undefined || value === '' ? '—' : String(value)}{hint && <small>{hint}</small>}</dd>
    </div>
  )
}
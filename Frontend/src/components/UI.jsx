/* Shared UI primitives */
import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Spinner({ size = 22 }) {
  return <div className="spinner" style={{ width: size, height: size }} />
}

export function Loader() {
  return (
    <div className="loader-full">
      <Spinner size={32} />
      <span>Loading…</span>
    </div>
  )
}

export function EmptyState({ icon = '📭', title = 'Nothing here', sub = '' }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      {sub && <div className="empty-state-sub">{sub}</div>}
    </div>
  )
}

export function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status?.replace('_', ' ')}</span>
}

export function Pagination({ meta, page, setPage }) {
  if (!meta || meta.total <= meta.limit) return null
  const total_pages = Math.ceil(meta.total / meta.limit)
  return (
    <div className="pagination">
      <span style={{ fontSize: 13, color: 'var(--text-3)', marginRight: 8 }}>
        {meta.offset + 1}–{Math.min(meta.offset + meta.limit, meta.total)} of {meta.total}
      </span>
      <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
        <ChevronLeft size={14} />
      </button>
      {Array.from({ length: total_pages }, (_, i) => i + 1)
        .filter(p => Math.abs(p - page) < 3)
        .map(p => (
          <button
            key={p}
            className={`page-btn${p === page ? ' active' : ''}`}
            onClick={() => setPage(p)}
          >{p}</button>
        ))
      }
      <button className="page-btn" disabled={page === total_pages} onClick={() => setPage(p => p + 1)}>
        <ChevronRight size={14} />
      </button>
    </div>
  )
}

export function Modal({ title, children, footer, onClose, size = '' }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal${size ? ' modal-' + size : ''}`}>
        <div className="modal-title">{title}</div>
        {children}
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

export function InputGroup({ label, id, ...props }) {
  return (
    <div className="input-group">
      {label && <label className="input-label" htmlFor={id}>{label}</label>}
      <input id={id} className="input" {...props} />
    </div>
  )
}

export function SelectGroup({ label, id, children, ...props }) {
  return (
    <div className="input-group">
      {label && <label className="input-label" htmlFor={id}>{label}</label>}
      <select id={id} className="input" {...props}>{children}</select>
    </div>
  )
}

export function fmt_currency(val) {
  if (val == null) return '—'
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export function fmt_date(val) {
  if (!val) return '—'
  return new Date(val).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

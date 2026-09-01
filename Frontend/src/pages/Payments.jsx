import { useEffect, useState, useCallback } from 'react'
import { useToast } from '../context'
import API from '../api'
import { Loader, EmptyState, Pagination, fmt_currency, fmt_date } from '../components/UI'
import { Search, RefreshCw, CreditCard } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'

const METHODS = ['card', 'upi', 'bank_transfer', 'cash']

function PaymentModal({ bookingId, onClose, onPaid }) {
  const toast = useToast()
  const [amount, setAmount]   = useState('')
  const [method, setMethod]   = useState('card')
  const [loading, setLoading] = useState(false)
  const [payments, setPayments] = useState([])
  const [summary, setSummary]   = useState(null)

  useEffect(() => {
    API.get(`/bookings/${bookingId}/payments`).then(r => {
      setPayments(r.data.items || [])
      setSummary({ total_paid: r.data.total_paid, balance: r.data.balance })
    })
  }, [bookingId])

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const key = uuidv4()
      await API.post(`/bookings/${bookingId}/payments`, { amount, method }, {
        headers: { 'Idempotency-Key': key }
      })
      toast.success('Payment recorded.')
      onPaid()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Payment failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-title">Payments — Booking #{bookingId}</div>

        {summary && (
          <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Total Paid: <strong style={{ color: 'var(--success)' }}>{fmt_currency(summary.total_paid)}</strong>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              Balance Due: <strong style={{ color: parseFloat(summary.balance) > 0 ? 'var(--rose)' : 'var(--success)' }}>
                {fmt_currency(summary.balance)}
              </strong>
            </div>
          </div>
        )}

        {payments.length > 0 && (
          <div className="table-wrap" style={{ marginBottom: 20 }}>
            <table>
              <thead><tr><th>ID</th><th>Amount</th><th>Method</th><th>Date</th></tr></thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td><strong>{fmt_currency(p.amount)}</strong></td>
                    <td style={{ textTransform: 'capitalize' }}>{p.method.replace('_', ' ')}</td>
                    <td>{p.paid_at ? p.paid_at.split('T')[0] : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {parseFloat(summary?.balance || '1') > 0 && (
          <form onSubmit={submit}>
            <div className="form-grid">
              <div className="input-group">
                <label className="input-label" htmlFor="pay-amount">Amount (₹)</label>
                <input id="pay-amount" className="input" type="number" step="0.01" min="0.01"
                  value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="pay-method">Method</label>
                <select id="pay-method" className="input" value={method} onChange={e => setMethod(e.target.value)}>
                  {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <CreditCard size={15} /> {loading ? 'Processing…' : 'Record Payment'}
              </button>
            </div>
          </form>
        )}
        {parseFloat(summary?.balance || '1') <= 0 && (
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Payments() {
  const toast = useToast()
  const [data, setData]     = useState({ items: [], meta: null })
  const [loading, setLoading] = useState(true)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(null)
  const LIMIT = 20

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: (page - 1) * LIMIT })
      const { data: d } = await API.get(`/bookings?${params}`)
      setData(d)
    } catch { toast.error('Failed to load.') }
    finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetch() }, [fetch])

  const filtered = search
    ? data.items.filter(b =>
        String(b.id).includes(search) ||
        b.guest_name?.toLowerCase().includes(search.toLowerCase())
      )
    : data.items

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-sub">Manage instalments and track balances</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div className="search-bar" style={{ width: 220 }}>
            <Search size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input placeholder="Booking # or guest…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-ghost btn-sm" onClick={fetch}><RefreshCw size={14} /></button>
        </div>
      </div>

      {loading ? <Loader /> : filtered.length === 0 ? (
        <EmptyState icon="💳" title="No bookings found" />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Guest</th>
                  <th>Check-in</th>
                  <th>Status</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td>#{b.id}</td>
                    <td><strong>{b.guest_name || `#${b.guest_id}`}</strong></td>
                    <td>{b.check_in}</td>
                    <td>
                      <span className={`badge badge-${b.status}`}>{b.status.replace('_', ' ')}</span>
                    </td>
                    <td>{fmt_currency(b.total_amount)}</td>
                    <td style={{ color: 'var(--success)' }}>{fmt_currency(b.total_paid)}</td>
                    <td style={{ color: parseFloat(b.balance) > 0 ? 'var(--rose)' : 'var(--success)', fontWeight: 600 }}>
                      {fmt_currency(b.balance)}
                    </td>
                    <td>
                      <button id={`pay-btn-${b.id}`} className="btn btn-ghost btn-sm"
                        onClick={() => setModal(b.id)}>
                        <CreditCard size={13} /> Payments
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} page={page} setPage={setPage} />
        </>
      )}

      {modal && <PaymentModal bookingId={modal} onClose={() => setModal(null)} onPaid={fetch} />}
    </div>
  )
}

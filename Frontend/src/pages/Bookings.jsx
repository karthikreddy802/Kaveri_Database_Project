import { useEffect, useState, useCallback } from 'react'
import { useAuth, useToast } from '../context'
import API from '../api'
import {
  Loader, EmptyState, StatusBadge, Pagination, Modal,
  InputGroup, SelectGroup, fmt_currency, fmt_date
} from '../components/UI'
import { Plus, Search, RefreshCw, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'

const STATUSES = ['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']
const METHODS   = ['card', 'upi', 'bank_transfer', 'cash']

function NewBookingModal({ onClose, onCreated }) {
  const { account } = useAuth()
  const toast = useToast()
  const [rooms, setRooms]   = useState([])
  const [props, setProps]   = useState([])
  const [guestsList, setGuestsList] = useState([])
  const [propId, setPropId] = useState('')
  const [form, setForm]     = useState({
    room_id: '', check_in: '', check_out: '',
    guests: 1, deposit_amount: '', deposit_method: 'card',
    guest_id: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    API.get('/properties').then(r => setProps(r.data.items || []))
    if (account?.role !== 'guest') {
      API.get('/guests?limit=100').then(r => setGuestsList(r.data.items || []))
    }
  }, [account])

  useEffect(() => {
    if (!propId || !form.check_in || !form.check_out) return
    API.get(`/properties/${propId}/availability?from=${form.check_in}&to=${form.check_out}`)
      .then(r => setRooms(r.data.items || []))
      .catch(() => setRooms([]))
  }, [propId, form.check_in, form.check_out])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const body = {
        room_id:   parseInt(form.room_id),
        check_in:  form.check_in,
        check_out: form.check_out,
        guests:    parseInt(form.guests),
      }
      if (account?.role !== 'guest') {
        if (!form.guest_id) {
          toast.error('Please select a guest.')
          setLoading(false)
          return
        }
        body.guest_id = parseInt(form.guest_id)
      }
      if (form.deposit_amount) {
        body.deposit = { amount: String(parseFloat(form.deposit_amount).toFixed(2)), method: form.deposit_method }
      }
      const { data } = await API.post('/bookings', body)
      toast.success(`Booking #${data.id} created!`)
      onCreated()
      onClose()
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.detail
        || 'Failed to create booking.'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <Modal title="New Booking" onClose={onClose} size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="new-booking-form" type="submit" disabled={loading}>
            {loading ? 'Creating…' : 'Create Booking'}
          </button>
        </>
      }
    >
      <form id="new-booking-form" onSubmit={submit}>
        <div className="form-grid">
          {account?.role !== 'guest' && (
            <SelectGroup label="Guest" id="nb-guest" value={form.guest_id} onChange={set('guest_id')} required>
              <option value="">Select guest…</option>
              {guestsList.map(g => <option key={g.id} value={g.id}>{g.full_name} ({g.email})</option>)}
            </SelectGroup>
          )}
          <SelectGroup label="Property" id="nb-prop" value={propId} onChange={e => setPropId(e.target.value)} required>
            <option value="">Select property…</option>
            {props.map(p => <option key={p.id} value={p.id}>{p.name} — {p.city}</option>)}
          </SelectGroup>
          <InputGroup label="Guests" id="nb-guests" type="number" min={1} value={form.guests} onChange={set('guests')} required />
          <InputGroup label="Check-in" id="nb-ci" type="date" min={today} value={form.check_in} onChange={set('check_in')} required />
          <InputGroup label="Check-out" id="nb-co" type="date" min={form.check_in || today} value={form.check_out} onChange={set('check_out')} required />
          <div className="input-group span-2">
            <label className="input-label" htmlFor="nb-room">Available Room</label>
            <select id="nb-room" className="input" value={form.room_id} onChange={set('room_id')} required>
              <option value="">
                {!propId ? '(Select a property first)' : !form.check_in || !form.check_out ? '(Set dates first)' : rooms.length === 0 ? 'No rooms available' : 'Select room…'}
              </option>
              {rooms.map(r => (
                <option key={r.room_id} value={r.room_id}>
                  Room {r.room_number} — {r.room_type.name} (max {r.room_type.max_occupancy}) — {fmt_currency(r.total_rate)} total
                </option>
              ))}
            </select>
          </div>
          <div className="divider span-2" style={{ margin: '4px 0' }} />
          <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Initial Deposit (optional)
          </div>
          <InputGroup label="Deposit Amount (₹)" id="nb-dep" type="number" step="0.01" min="0" value={form.deposit_amount} onChange={set('deposit_amount')} placeholder="0.00" />
          <SelectGroup label="Payment Method" id="nb-meth" value={form.deposit_method} onChange={set('deposit_method')}>
            {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </SelectGroup>
        </div>
      </form>
    </Modal>
  )
}

export default function Bookings() {
  const { account } = useAuth()
  const toast       = useToast()
  const [data, setData]     = useState({ items: [], meta: null })
  const [loading, setLoading] = useState(true)
  const [page, setPage]     = useState(1)
  const [status, setStatus] = useState('')
  const [showNew, setShowNew] = useState(false)
  const LIMIT = 20

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: LIMIT, offset: (page - 1) * LIMIT,
        sort: '-check_in',
      })
      if (status) params.set('status', status)
      const { data: d } = await API.get(`/bookings?${params}`)
      setData(d)
    } catch { toast.error('Failed to load bookings.') }
    finally { setLoading(false) }
  }, [page, status])

  useEffect(() => { fetch() }, [fetch])

  const transition = async (id, action, label) => {
    try {
      await API.post(`/bookings/${id}/${action}`)
      toast.success(`Booking #${id} ${label}.`)
      fetch()
    } catch (err) {
      toast.error(err.response?.data?.detail?.error?.message || err.response?.data?.detail || `Failed to ${label}.`)
    }
  }

  const canAction = b => {
    const role = account?.role
    if (role === 'guest') return ['cancel'].filter(() => b.status === 'confirmed')
    if (['staff','manager','owner'].includes(role)) {
      const acts = []
      if (b.status === 'confirmed')  acts.push('check-in', 'cancel', 'no-show')
      if (b.status === 'checked_in') acts.push('check-out')
      return acts
    }
    return []
  }

  const ACTION_LABELS = {
    'check-in':  'Checked In',
    'check-out': 'Checked Out',
    'cancel':    'Cancelled',
    'no-show':   'No Show',
  }
  const ACTION_STYLE = {
    'check-in':  'btn-ghost',
    'check-out': 'btn-ghost',
    'cancel':    'btn-danger',
    'no-show':   'btn-danger',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bookings</h1>
          <p className="page-sub">{data.meta?.total ?? 0} total reservations</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="input" style={{ width: 160 }} value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={fetch}><RefreshCw size={14} /></button>
          <button id="new-booking-btn" className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> New Booking
          </button>
        </div>
      </div>

      {loading ? <Loader /> : data.items.length === 0 ? (
        <EmptyState icon="📋" title="No bookings found" sub="Try changing the filter." />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Guest</th>
                  <th>Room</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Nights</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(b => (
                  <tr key={b.id}>
                    <td>{b.id}</td>
                    <td><strong>{b.guest_name || `#${b.guest_id}`}</strong></td>
                    <td>Rm {b.room_number || b.room_id}</td>
                    <td>{b.check_in}</td>
                    <td>{b.check_out}</td>
                    <td>{b.nights}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td><strong>{fmt_currency(b.total_amount)}</strong></td>
                    <td style={{ color: parseFloat(b.balance) > 0 ? 'var(--rose)' : 'var(--success)' }}>
                      {fmt_currency(b.balance)}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canAction(b).map(act => (
                          <button key={act} className={`btn btn-sm ${ACTION_STYLE[act]}`}
                            onClick={() => transition(b.id, act, ACTION_LABELS[act])}>
                            {act.replace('-', ' ')}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} page={page} setPage={setPage} />
        </>
      )}

      {showNew && <NewBookingModal onClose={() => setShowNew(false)} onCreated={fetch} />}
    </div>
  )
}

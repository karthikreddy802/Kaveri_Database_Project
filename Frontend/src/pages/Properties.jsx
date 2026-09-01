import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../api'
import { Loader, EmptyState, Modal, InputGroup, SelectGroup, fmt_currency } from '../components/UI'
import { Building2, MapPin, Star, CalendarCheck } from 'lucide-react'
import { useAuth, useToast } from '../context'

const METHODS = ['card', 'upi', 'bank_transfer', 'cash']

function BookModal({ room, property, checkIn, checkOut, nights, onClose }) {
  const { account } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [guestsList, setGuestsList] = useState([])
  const [form, setForm] = useState({
    guests: 1,
    deposit_amount: '',
    deposit_method: 'card',
    guest_id: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (account?.role !== 'guest') {
      API.get('/guests?limit=100').then(r => setGuestsList(r.data.items || []))
    }
  }, [account])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      const body = {
        room_id: room.room_id,
        check_in: checkIn,
        check_out: checkOut,
        guests: parseInt(form.guests),
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
        body.deposit = {
          amount: String(parseFloat(form.deposit_amount).toFixed(2)),
          method: form.deposit_method
        }
      }
      const { data } = await API.post('/bookings', body)
      toast.success(`Booking #${data.id} confirmed!`)
      onClose()
      navigate('/bookings')
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.detail
        || 'Failed to create booking.'
      toast.error(msg)
    } finally { setLoading(false) }
  }

  return (
    <Modal
      title={`Book Room ${room.room_number} — ${property.name}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="book-room-form" type="submit" disabled={loading}>
            {loading ? 'Confirming…' : 'Confirm Booking'}
          </button>
        </>
      }
    >
      {/* Summary */}
      <div style={{
        background: 'var(--bg-3)', borderRadius: 10, padding: '14px 18px',
        marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Room {room.room_number}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
            {room.room_type.name} · max {room.room_type.max_occupancy} guests
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
            {checkIn} → {checkOut} ({nights} night{nights !== 1 ? 's' : ''})
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 18 }}>
            {fmt_currency(room.total_rate)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>total stay</div>
        </div>
      </div>

      <form id="book-room-form" onSubmit={submit}>
        <div className="form-grid">
          {account?.role !== 'guest' && (
            <SelectGroup label="Guest" id="bk-guest" value={form.guest_id} onChange={set('guest_id')} required>
              <option value="">Select guest…</option>
              {guestsList.map(g => (
                <option key={g.id} value={g.id}>{g.full_name} ({g.email})</option>
              ))}
            </SelectGroup>
          )}
          <InputGroup
            label={`Number of Guests (max ${room.room_type.max_occupancy})`}
            id="bk-guests" type="number"
            min={1} max={room.room_type.max_occupancy}
            value={form.guests} onChange={set('guests')} required
          />
          <div className="divider span-2" style={{ margin: '4px 0' }} />
          <div style={{ gridColumn: '1/-1', fontSize: 12, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Initial Deposit (optional)
          </div>
          <InputGroup
            label="Deposit Amount (₹)" id="bk-dep"
            type="number" step="0.01" min="0"
            value={form.deposit_amount} onChange={set('deposit_amount')}
            placeholder="0.00"
          />
          <SelectGroup label="Payment Method" id="bk-meth" value={form.deposit_method} onChange={set('deposit_method')}>
            {METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
          </SelectGroup>
        </div>
      </form>
    </Modal>
  )
}

export default function Properties() {
  const [props, setProps]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [avail, setAvail]       = useState({})
  const [form, setForm]         = useState({ from: '', to: '' })
  const [checked, setChecked]   = useState(false)
  const [booking, setBooking]   = useState(null) // { room, property }

  useEffect(() => {
    API.get('/properties').then(r => setProps(r.data.items || [])).finally(() => setLoading(false))
  }, [])

  const checkAvailability = async e => {
    e.preventDefault()
    const results = {}
    await Promise.all(
      props.map(async p => {
        try {
          const { data } = await API.get(
            `/properties/${p.id}/availability?from=${form.from}&to=${form.to}`
          )
          results[p.id] = data.items || []
        } catch { results[p.id] = [] }
      })
    )
    setAvail(results)
    setChecked(true)
  }

  const nights = form.from && form.to
    ? Math.max(0, (new Date(form.to) - new Date(form.from)) / 86400000)
    : 0

  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="page-sub">Browse hotel inventory and check availability</p>
        </div>
      </div>

      {/* Availability checker */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="chart-title" style={{ marginBottom: 16 }}>Check Availability</div>
        <form onSubmit={checkAvailability} style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label" htmlFor="avail-from">Check-in</label>
            <input id="avail-from" className="input" type="date" min={today}
              value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} required />
          </div>
          <div className="input-group" style={{ flex: 1 }}>
            <label className="input-label" htmlFor="avail-to">Check-out</label>
            <input id="avail-to" className="input" type="date" min={form.from || today}
              value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} required />
          </div>
          {nights > 0 && (
            <div style={{ fontSize: 13, color: 'var(--text-3)', paddingBottom: 10 }}>
              {nights} night{nights > 1 ? 's' : ''}
            </div>
          )}
          <button type="submit" className="btn btn-primary">Check Availability</button>
        </form>
      </div>

      {loading ? <Loader /> : props.length === 0 ? (
        <EmptyState icon="🏨" title="No properties found" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {props.map(p => {
            const rooms = checked ? (avail[p.id] || []) : []
            return (
              <div key={p.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Property header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 10,
                      background: 'linear-gradient(135deg, var(--gold), #d49b10)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0
                    }}>🏨</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>
                        <MapPin size={12} /> {p.city}
                      </div>
                    </div>
                  </div>
                  {p.stars && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      {Array.from({ length: p.stars }, (_, i) => (
                        <Star key={i} size={12} fill="var(--gold)" stroke="var(--gold)" />
                      ))}
                    </div>
                  )}
                </div>

                {/* Availability results */}
                {checked && (
                  <div>
                    {rooms.length === 0 ? (
                      <div style={{ fontSize: 13, color: 'var(--rose)', fontStyle: 'italic' }}>
                        No rooms available for selected dates.
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>
                          {rooms.length} Room{rooms.length > 1 ? 's' : ''} Available
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {rooms.slice(0, 4).map(r => (
                            <div key={r.room_id} style={{
                              background: 'var(--bg-3)', borderRadius: 8, padding: '10px 14px',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 14 }}>Room {r.room_number}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                  {r.room_type.name} · max {r.room_type.max_occupancy}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 14 }}>
                                    {fmt_currency(r.total_rate)}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>for {nights} nights</div>
                                </div>
                                <button
                                  className="btn btn-primary btn-sm"
                                  style={{ whiteSpace: 'nowrap' }}
                                  onClick={() => setBooking({ room: r, property: p })}
                                >
                                  <CalendarCheck size={14} /> Book Now
                                </button>
                              </div>
                            </div>
                          ))}
                          {rooms.length > 4 && (
                            <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
                              +{rooms.length - 4} more rooms available
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!checked && (
                  <div style={{ fontSize: 13, color: 'var(--text-3)', fontStyle: 'italic' }}>
                    Enter dates above to check room availability.
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Book Now modal */}
      {booking && (
        <BookModal
          room={booking.room}
          property={booking.property}
          checkIn={form.from}
          checkOut={form.to}
          nights={nights}
          onClose={() => setBooking(null)}
        />
      )}
    </div>
  )
}

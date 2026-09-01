import { useEffect, useState } from 'react'
import { useAuth } from '../context'
import API from '../api'
import { Loader, fmt_currency, StatusBadge } from '../components/UI'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import { Hotel, Users, CreditCard, TrendingUp, BookOpen, Star } from 'lucide-react'
import { format, subMonths } from 'date-fns'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' && p.name === 'Revenue' ? fmt_currency(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { account } = useAuth()
  const [stats, setStats]     = useState(null)
  const [recent, setRecent]   = useState([])
  const [chartData, setChart] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDash()
  }, [])

  async function fetchDash() {
    setLoading(true)
    try {
      const today = new Date()
      const from  = format(subMonths(today, 5), 'yyyy-MM-01')
      const to    = format(today, 'yyyy-MM-dd')

      const [booksRes, propsRes] = await Promise.all([
        API.get('/bookings?limit=10&sort=-created_at'),
        API.get('/properties'),
      ])

      setRecent(booksRes.data.items || [])

      const total_bookings  = booksRes.data.meta?.total ?? 0
      const total_props     = propsRes.data.items?.length ?? 0

      // Revenue / occupancy for manager/owner
      let revenue = 0, occ = '—'
      if (['manager', 'owner'].includes(account?.role)) {
        try {
          const prop_id = account.property_id || propsRes.data.items?.[0]?.id
          if (prop_id) {
            const [revRes, occRes] = await Promise.all([
              account.role === 'owner'
                ? API.get(`/reports/revenue?from=${from}&to=${to}`)
                : Promise.resolve({ data: { grand_total: '0' } }),
              API.get(`/reports/occupancy?from=${from}&to=${to}&property_id=${prop_id}`)
            ])
            revenue = revRes.data.grand_total || 0
            const rows = occRes.data.items || []
            setChart(rows.map(r => ({
              month: r.month,
              Occupancy: parseFloat(r.occupancy_pct),
            })))
            const latest = rows[rows.length - 1]
            if (latest) occ = parseFloat(latest.occupancy_pct).toFixed(1) + '%'
          }
        } catch {}
      }

      setStats({ total_bookings, total_props, revenue, occ })
    } catch (e) {
      /* keep dashboard usable when a report/booking call fails */
    } finally { setLoading(false) }
  }

  if (loading) return <Loader />

  const isStaff = ['staff', 'manager', 'owner'].includes(account?.role)

  return (
    <div>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},&nbsp;
            {account?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="page-sub">Here's what's happening at Kaveri Stays today.</p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="stat-grid">
        <div className="stat-card gold">
          <div className="stat-label">Total Bookings</div>
          <div className="stat-value">{stats?.total_bookings ?? '—'}</div>
          <div className="stat-sub">All time reservations</div>
          <div className="stat-icon" style={{ background: 'rgba(245,200,66,0.12)', color: 'var(--gold)' }}>
            <BookOpen size={20} />
          </div>
        </div>
        <div className="stat-card teal">
          <div className="stat-label">Properties</div>
          <div className="stat-value">{stats?.total_props ?? '—'}</div>
          <div className="stat-sub">Active properties</div>
          <div className="stat-icon" style={{ background: 'rgba(45,212,191,0.12)', color: 'var(--teal)' }}>
            <Hotel size={20} />
          </div>
        </div>
        {isStaff && (
          <div className="stat-card violet">
            <div className="stat-label">Occupancy</div>
            <div className="stat-value">{stats?.occ}</div>
            <div className="stat-sub">This month</div>
            <div className="stat-icon" style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--violet)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
        )}
        {['manager','owner'].includes(account?.role) && (
          <div className="stat-card rose">
            <div className="stat-label">Revenue (6M)</div>
            <div className="stat-value">{fmt_currency(stats?.revenue)}</div>
            <div className="stat-sub">Payments collected</div>
            <div className="stat-icon" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--rose)' }}>
              <CreditCard size={20} />
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: chartData.length ? '1fr 380px' : '1fr', gap: 20 }}>
        {/* Recent bookings */}
        <div className="card">
          <div className="chart-title" style={{ marginBottom: 16 }}>Recent Bookings</div>
          {recent.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No bookings yet</div>
            </div>
          ) : (
            <div className="table-wrap" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Guest</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(b => (
                    <tr key={b.id}>
                      <td>{b.id}</td>
                      <td><strong>{b.guest_name || `Guest #${b.guest_id}`}</strong></td>
                      <td style={{ fontSize: 12 }}>
                        {b.check_in} → {b.check_out}
                      </td>
                      <td><StatusBadge status={b.status} /></td>
                      <td><strong>{fmt_currency(b.total_amount)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Occupancy chart (manager/owner) */}
        {chartData.length > 0 && (
          <div className="chart-card">
            <div className="chart-title">Monthly Occupancy %</div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--gold)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 11 }} unit="%" domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="Occupancy"
                  stroke="var(--gold)" strokeWidth={2}
                  fill="url(#occ)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

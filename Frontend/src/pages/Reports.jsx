import { useEffect, useState, useCallback } from 'react'
import { useAuth, useToast } from '../context'
import API from '../api'
import { Loader, EmptyState, fmt_currency } from '../components/UI'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, AreaChart, Area
} from 'recharts'
import { format, subMonths } from 'date-fns'
import { TrendingUp, BarChart2, DollarSign, Percent } from 'lucide-react'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
      <p style={{ color: 'var(--text-3)', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color || 'var(--text-1)' }}>
          {p.name}: {p.name === 'Revenue' ? fmt_currency(p.value) : typeof p.value === 'number' ? p.value.toFixed(2) : p.value}
          {p.name === 'Occupancy' ? '%' : ''}
        </p>
      ))}
    </div>
  )
}

export default function Reports() {
  const { account } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState('occupancy')
  const [props, setProps]   = useState([])
  const [propId, setPropId] = useState('')

  const today = new Date()
  const [from, setFrom] = useState(format(subMonths(today, 5), 'yyyy-MM-01'))
  const [to, setTo]     = useState(format(today, 'yyyy-MM-dd'))

  const [occ,     setOcc]     = useState([])
  const [adr,     setAdr]     = useState([])
  const [revpar,  setRevpar]  = useState([])
  const [rev,     setRev]     = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (account?.role === 'owner') {
      API.get('/properties').then(r => {
        const items = r.data.items || []
        setProps(items)
        if (items.length) setPropId(items[0].id)
      })
    } else if (account?.role === 'manager') {
      setPropId(account.property_id)
    }
  }, [account])

  const load = useCallback(async () => {
    if (!propId) return
    setLoading(true)
    try {
      const pid = propId || (account?.property_id)
      const [occR, adrR, revparR] = await Promise.all([
        API.get(`/reports/occupancy?from=${from}&to=${to}&property_id=${pid}`),
        API.get(`/reports/adr?from=${from}&to=${to}&property_id=${pid}`),
        API.get(`/reports/revpar?from=${from}&to=${to}&property_id=${pid}`),
      ])
      setOcc(occR.data.items || [])
      setAdr(adrR.data.items || [])
      setRevpar(revparR.data.items || [])

      if (account?.role === 'owner') {
        const revR = await API.get(`/reports/revenue?from=${from}&to=${to}`)
        setRev(revR.data)
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load reports.')
    } finally { setLoading(false) }
  }, [propId, from, to, account])

  useEffect(() => { load() }, [load])

  // Merge all KPIs for the chart
  const chartData = occ.map((r, i) => ({
    month:     r.month,
    Occupancy: parseFloat(r.occupancy_pct),
    ADR:       parseFloat(adr[i]?.value || 0),
    RevPAR:    parseFloat(revpar[i]?.value || 0),
  }))

  const revenueByProperty = rev?.items?.reduce((acc, r) => {
    if (!acc[r.property_id]) acc[r.property_id] = { name: r.property_name, total: 0 }
    acc[r.property_id].total += parseFloat(r.revenue)
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Reports</h1>
          <p className="page-sub">Occupancy, ADR, RevPAR and revenue insights</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {account?.role === 'owner' && props.length > 0 && (
            <div className="input-group" style={{ minWidth: 200 }}>
              <label className="input-label" htmlFor="rpt-prop">Property</label>
              <select id="rpt-prop" className="input" value={propId} onChange={e => setPropId(e.target.value)}>
                {props.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
          <div className="input-group">
            <label className="input-label" htmlFor="rpt-from">From</label>
            <input id="rpt-from" className="input" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="rpt-to">To</label>
            <input id="rpt-to" className="input" type="date" min={from} value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Apply'}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && occ.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card teal">
            <div className="stat-label">Avg Occupancy</div>
            <div className="stat-value">
              {(occ.reduce((s, r) => s + parseFloat(r.occupancy_pct), 0) / occ.length).toFixed(1)}%
            </div>
            <div className="stat-sub">over selected period</div>
            <div className="stat-icon" style={{ background: 'rgba(45,212,191,0.12)', color: 'var(--teal)' }}>
              <Percent size={20} />
            </div>
          </div>
          <div className="stat-card gold">
            <div className="stat-label">Avg ADR</div>
            <div className="stat-value">
              {fmt_currency(adr.reduce((s, r) => s + parseFloat(r.value), 0) / (adr.length || 1))}
            </div>
            <div className="stat-sub">average daily rate</div>
            <div className="stat-icon" style={{ background: 'rgba(245,200,66,0.12)', color: 'var(--gold)' }}>
              <BarChart2 size={20} />
            </div>
          </div>
          <div className="stat-card violet">
            <div className="stat-label">Avg RevPAR</div>
            <div className="stat-value">
              {fmt_currency(revpar.reduce((s, r) => s + parseFloat(r.value), 0) / (revpar.length || 1))}
            </div>
            <div className="stat-sub">revenue per avail. room</div>
            <div className="stat-icon" style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--violet)' }}>
              <TrendingUp size={20} />
            </div>
          </div>
          {rev && (
            <div className="stat-card rose">
              <div className="stat-label">Total Revenue</div>
              <div className="stat-value">{fmt_currency(rev.grand_total)}</div>
              <div className="stat-sub">all properties</div>
              <div className="stat-icon" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--rose)' }}>
                <DollarSign size={20} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab${tab === 'occupancy' ? ' active' : ''}`} onClick={() => setTab('occupancy')}>Occupancy</div>
        <div className={`tab${tab === 'rates' ? ' active' : ''}`} onClick={() => setTab('rates')}>ADR & RevPAR</div>
        {rev && <div className={`tab${tab === 'revenue' ? ' active' : ''}`} onClick={() => setTab('revenue')}>Revenue</div>}
      </div>

      {loading ? <Loader /> : chartData.length === 0 ? (
        <EmptyState icon="📊" title="No data" sub="Try expanding the date range." />
      ) : (
        <div className="chart-card">
          {tab === 'occupancy' && (
            <>
              <div className="chart-title">Monthly Occupancy (%)</div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="occ2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="var(--teal)" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="var(--teal)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 12 }} unit="%" domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Occupancy" stroke="var(--teal)" strokeWidth={2.5} fill="url(#occ2)" />
                </AreaChart>
              </ResponsiveContainer>
            </>
          )}

          {tab === 'rates' && (
            <>
              <div className="chart-title">ADR vs RevPAR (₹)</div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 13, color: 'var(--text-2)' }} />
                  <Line type="monotone" dataKey="ADR"    stroke="var(--gold)"    strokeWidth={2.5} dot={{ r: 4, fill: 'var(--gold)' }} />
                  <Line type="monotone" dataKey="RevPAR" stroke="var(--violet)"  strokeWidth={2.5} dot={{ r: 4, fill: 'var(--violet)' }} />
                </LineChart>
              </ResponsiveContainer>
            </>
          )}

          {tab === 'revenue' && rev && (
            <>
              <div className="chart-title">Revenue by Property (₹)</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={Object.values(revenueByProperty || {})}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="var(--gold)"  stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--gold-dim)" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="total" name="Revenue" fill="url(#rev)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      )}

      {/* Raw table */}
      {!loading && occ.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="chart-title" style={{ marginBottom: 16 }}>Monthly Breakdown</div>
          <div className="table-wrap" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Rooms Avail.</th>
                  <th>Rooms Sold</th>
                  <th>Occupancy</th>
                  <th>ADR</th>
                  <th>RevPAR</th>
                </tr>
              </thead>
              <tbody>
                {occ.map((r, i) => (
                  <tr key={r.month}>
                    <td><strong>{r.month}</strong></td>
                    <td>{r.room_nights_available}</td>
                    <td>{r.room_nights_sold}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 6, background: 'var(--bg-3)', borderRadius: 3 }}>
                          <div style={{ width: `${Math.min(100, parseFloat(r.occupancy_pct))}%`, height: '100%', background: 'var(--teal)', borderRadius: 3 }} />
                        </div>
                        <span>{parseFloat(r.occupancy_pct).toFixed(1)}%</span>
                      </div>
                    </td>
                    <td>{fmt_currency(adr[i]?.value)}</td>
                    <td>{fmt_currency(revpar[i]?.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { useToast } from '../context'
import API from '../api'
import { Loader, EmptyState, Pagination } from '../components/UI'
import { Search, RefreshCw } from 'lucide-react'

export default function Guests() {
  const toast = useToast()
  const [data, setData]     = useState({ items: [], meta: null })
  const [loading, setLoading] = useState(true)
  const [page, setPage]     = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery]   = useState('')
  const LIMIT = 25

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: LIMIT, offset: (page - 1) * LIMIT })
      if (query) params.set('email', query)
      const { data: d } = await API.get(`/guests?${params}`)
      setData(d)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load guests.')
    } finally { setLoading(false) }
  }, [page, query])

  useEffect(() => { fetch() }, [fetch])

  const handleSearch = e => {
    e.preventDefault()
    setQuery(search)
    setPage(1)
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Guests</h1>
          <p className="page-sub">{data.meta?.total ?? 0} guest records</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
            <div className="search-bar" style={{ width: 240 }}>
              <Search size={15} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              <input placeholder="Search by email…" value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-ghost btn-sm">Search</button>
          </form>
          <button className="btn btn-ghost btn-sm" onClick={fetch}><RefreshCw size={14} /></button>
        </div>
      </div>

      {loading ? <Loader /> : data.items.length === 0 ? (
        <EmptyState icon="👥" title="No guests found"
          sub={query ? `No results for "${query}"` : 'Guest records will appear here.'} />
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Total Stays</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map(g => (
                  <tr key={g.id}>
                    <td>#{g.id}</td>
                    <td><strong>{g.full_name}</strong></td>
                    <td style={{ color: 'var(--text-2)' }}>{g.email}</td>
                    <td>{g.phone || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                    <td>
                      <span style={{
                        background: 'rgba(45,212,191,0.12)',
                        color: 'var(--teal)',
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600
                      }}>
                        {g.stay_count ?? 0} stays
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={data.meta} page={page} setPage={setPage} />
        </>
      )}
    </div>
  )
}

import { useEffect, useState, useCallback } from 'react'
import { useAuth, useToast } from '../context'
import API from '../api'
import { Loader, EmptyState, Pagination } from '../components/UI'
import { Star, RefreshCw } from 'lucide-react'

function StarRating({ rating, max = 5 }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} size={14}
          fill={i < rating ? 'var(--gold)' : 'none'}
          stroke={i < rating ? 'var(--gold)' : 'var(--text-3)'}
        />
      ))}
    </div>
  )
}

function PostReviewModal({ bookingId, onClose, onPosted }) {
  const toast = useToast()
  const [rating, setRating]   = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [hover, setHover]     = useState(0)

  const submit = async e => {
    e.preventDefault()
    setLoading(true)
    try {
      await API.post(`/bookings/${bookingId}/review`, { rating, comment: comment || undefined })
      toast.success('Review posted!')
      onPosted()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to post review.')
    } finally { setLoading(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-title">Post a Review</div>
        <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
          Booking #{bookingId}
        </p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="input-group">
            <label className="input-label">Your Rating</label>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} size={28} style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                  fill={s <= (hover || rating) ? 'var(--gold)' : 'none'}
                  stroke={s <= (hover || rating) ? 'var(--gold)' : 'var(--text-3)'}
                  onMouseEnter={() => setHover(s)}
                  onMouseLeave={() => setHover(0)}
                  onClick={() => setRating(s)}
                />
              ))}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label" htmlFor="rev-comment">Comment (optional)</label>
            <textarea id="rev-comment" className="input" rows={4}
              placeholder="Share your experience…"
              value={comment} onChange={e => setComment(e.target.value)} maxLength={2000} />
            <span style={{ fontSize: 11, color: 'var(--text-3)', textAlign: 'right' }}>{comment.length}/2000</span>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Posting…' : 'Post Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Reviews() {
  const { account } = useAuth()
  const toast = useToast()

  // For public review feed — pick first property
  const [props, setProps]         = useState([])
  const [propId, setPropId]       = useState('')
  const [reviews, setReviews]     = useState({ items: [], meta: null })
  const [loading, setLoading]     = useState(false)
  const [page, setPage]           = useState(1)

  // For guest "my bookings to review"
  const [checkedOut, setCheckedOut] = useState([])
  const [reviewModal, setReviewModal] = useState(null)

  const LIMIT = 10

  useEffect(() => {
    API.get('/properties').then(r => {
      const items = r.data.items || []
      setProps(items)
      if (items.length) setPropId(items[0].id)
    })
    if (account?.role === 'guest') {
      API.get('/bookings?status=checked_out&limit=50').then(r => setCheckedOut(r.data.items || []))
    }
  }, [account])

  const fetchReviews = useCallback(async () => {
    if (!propId) return
    setLoading(true)
    try {
      const { data } = await API.get(`/properties/${propId}/reviews?limit=${LIMIT}&offset=${(page - 1) * LIMIT}`)
      setReviews(data)
    } catch { toast.error('Failed to load reviews.') }
    finally { setLoading(false) }
  }, [propId, page])

  useEffect(() => { fetchReviews() }, [fetchReviews])

  const avgRating = reviews.items.length
    ? (reviews.items.reduce((s, r) => s + r.rating, 0) / reviews.items.length).toFixed(1)
    : '—'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reviews</h1>
          <p className="page-sub">Guest feedback and ratings</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select className="input" style={{ width: 200 }} value={propId} onChange={e => { setPropId(e.target.value); setPage(1) }}>
            {props.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={fetchReviews}><RefreshCw size={14} /></button>
        </div>
      </div>

      {/* Guest: post a review section */}
      {account?.role === 'guest' && checkedOut.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="chart-title" style={{ marginBottom: 14 }}>Your Completed Stays</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {checkedOut.slice(0, 5).map(b => (
              <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>Booking #{b.id}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 12 }}>{b.check_in} → {b.check_out}</span>
                </div>
                <button id={`review-btn-${b.id}`} className="btn btn-ghost btn-sm" onClick={() => setReviewModal(b.id)}>
                  <Star size={13} /> Write Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary card */}
      {reviews.items.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          <div className="stat-card gold" style={{ maxWidth: 160 }}>
            <div className="stat-label">Avg Rating</div>
            <div className="stat-value">{avgRating}</div>
            <StarRating rating={Math.round(parseFloat(avgRating))} />
          </div>
          <div className="stat-card teal" style={{ maxWidth: 160 }}>
            <div className="stat-label">Total Reviews</div>
            <div className="stat-value">{reviews.meta?.total ?? reviews.items.length}</div>
            <div className="stat-sub">for this property</div>
          </div>
        </div>
      )}

      {/* Review list */}
      {loading ? <Loader /> : reviews.items.length === 0 ? (
        <EmptyState icon="⭐" title="No reviews yet" sub="Reviews will appear here after guests check out." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {reviews.items.map(r => (
            <div key={r.id} className="card animate-fade">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{r.guest_name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 12 }}>
                    Booking #{r.booking_id}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <StarRating rating={r.rating} />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : ''}
                  </span>
                </div>
              </div>
              {r.comment && <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 }}>{r.comment}</p>}
            </div>
          ))}
        </div>
      )}

      {!loading && reviews.meta && reviews.meta.total > LIMIT && (
        <Pagination meta={reviews.meta} page={page} setPage={setPage} />
      )}

      {reviewModal && (
        <PostReviewModal
          bookingId={reviewModal}
          onClose={() => setReviewModal(null)}
          onPosted={fetchReviews}
        />
      )}
    </div>
  )
}

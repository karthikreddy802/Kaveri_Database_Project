/**
 * Kaveri Stays — Authentication
 * Layout is owned by Login.css (CSS Grid) so the form cannot collapse.
 */
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, useToast } from '../context'
import API from '../api'
import { Mail, Lock, User, Phone, Eye, EyeOff, Check, AlertCircle, Shield, ArrowRight } from 'lucide-react'
import './Login.css'

class Confetti {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.particles = []
    this.active = false
    this.raf = null
  }
  start() {
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
    this.active = true
    this.particles = Array.from({ length: 180 }, () => ({
      x: Math.random() * this.canvas.width,
      y: Math.random() * -this.canvas.height,
      r: Math.random() * 6 + 3,
      d: Math.random() * 180,
      color: ['#FBBF24', '#FFD54F', '#34D399', '#38BDF8', '#F472B6', '#A78BFA'][Math.floor(Math.random() * 6)],
      tiltAngle: 0,
      tiltAngleIncremental: Math.random() * 0.07 + 0.02,
      tilt: 0,
    }))
    this.animate()
  }
  animate() {
    if (!this.active) return
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    let done = true
    for (const p of this.particles) {
      p.tiltAngle += p.tiltAngleIncremental
      p.y += (Math.cos(p.d) + 3 + p.r / 2) / 2
      p.x += Math.sin(p.tiltAngle) * 0.8
      p.tilt = Math.sin(p.tiltAngle) * 12
      if (p.y < this.canvas.height) done = false
      this.ctx.beginPath()
      this.ctx.lineWidth = p.r / 2
      this.ctx.strokeStyle = p.color
      this.ctx.moveTo(p.x + p.tilt + p.r / 4, p.y)
      this.ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4)
      this.ctx.stroke()
    }
    if (done) { this.active = false; return }
    this.raf = requestAnimationFrame(() => this.animate())
  }
  stop() {
    this.active = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }
}

function passwordStrength(pwd) {
  if (!pwd) return { score: 0, label: 'None', color: '#374151' }
  let s = 0
  if (pwd.length >= 10) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/[0-9]/.test(pwd)) s++
  if (/[^A-Za-z0-9]/.test(pwd)) s++
  const map = [
    { label: 'Too Short', color: '#EF4444' },
    { label: 'Weak', color: '#EF4444' },
    { label: 'Fair', color: '#F59E0B' },
    { label: 'Good', color: '#10B981' },
    { label: 'Strong', color: '#059669' },
  ]
  return { score: s, ...map[s] }
}

function Field({ id, label, type = 'text', value, onChange, icon: Icon, rightNode, required, placeholder }) {
  const [focused, setFocused] = useState(false)
  const on = focused || Boolean(value)
  return (
    <div className={`auth-field${on ? ' is-on' : ''}`}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        required={required}
        placeholder={on ? placeholder : ' '}
        aria-label={label}
      />
      {Icon && <Icon size={17} className="auth-field-icon" />}
      <label htmlFor={id}>{label}</label>
      {rightNode}
    </div>
  )
}

export default function Login() {
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPwd] = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [newsletter, setNewsletter] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const canvasRef = useRef(null)
  const confettiRef = useRef(null)

  useEffect(() => {
    if (canvasRef.current) confettiRef.current = new Confetti(canvasRef.current)
  }, [])

  const handleLoginSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const { data: tokens } = await API.post('/auth/login', { email: email.trim(), password })
      const { data: me } = await API.get('/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } })
      setSuccess(true)
      setTimeout(() => { login(me, tokens); toast.success(`Welcome back, ${me.full_name || me.email}!`); navigate('/') }, 1500)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.detail || 'Invalid email or password.')
      setLoading(false)
    }
  }

  const handleRegisterSubmit = async (e) => {
    e.preventDefault(); setError('')
    if (password !== confirmPwd) { setError('Passwords do not match.'); return }
    if (password.length < 10) { setError('Password must be at least 10 characters.'); return }
    if (!agreeTerms) { setError('You must agree to the Terms of Service.'); return }
    setLoading(true)
    try {
      const payload = { email, password, full_name: name }
      if (phone) payload.phone = phone
      await API.post('/auth/register', payload)
      setLoading(false)
      confettiRef.current?.start()
      toast.success('Registration successful! Please sign in.')
      setTab('login')
      setConfirmPwd(''); setPhone(''); setAgreeTerms(false)
    } catch (err) {
      setError(err.response?.data?.error?.message || err.response?.data?.detail || 'Registration failed.')
      setLoading(false)
    }
  }

  const handleForgotSubmit = (e) => {
    e.preventDefault(); setForgotSent(true)
    setTimeout(() => { setForgotSent(false); setShowForgot(false); setForgotEmail('') }, 3000)
  }

  const switchTab = (t) => { setTab(t); setError(''); setSuccess(false) }
  const ps = passwordStrength(password)

  const eye = (
    <button type="button" className="auth-eye" onClick={() => setShowPwd(v => !v)} aria-label="Toggle password">
      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )

  return (
    <div className="auth-page">
      <title>Sign In — Kaveri Stays</title>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 100 }} />

      <aside className="auth-hero">
        <img
          className="auth-hero-img"
          src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=90&w=1400&auto=format&fit=crop"
          alt="Luxury hotel"
        />
        <div className="auth-hero-shade" />
        <div className="auth-hero-inner">
          <div className="auth-brand">
            <div className="auth-brand-mark">🏨</div>
            <div>
              <div className="auth-brand-name">Kaveri <span>Stays</span></div>
              <div className="auth-brand-sub">Premium Hospitality</div>
            </div>
          </div>

          <div className="auth-hero-copy">
            <div className="auth-pill">✧ Five-star property management</div>
            <h1>Experience Comfort<br /><em>Beyond Expectations</em></h1>
            <p>Book smarter. Stay better. Manage your luxury property experience with absolute elegance.</p>

            <div className="auth-prop">
              <div className="auth-prop-left">
                <span style={{ fontSize: 22 }}>🏨</span>
                <div>
                  <strong>Kaveri Grand Palace</strong>
                  <small>Mysore · ★ 5.0</small>
                </div>
              </div>
              <span className="auth-prop-badge" style={{ color: '#10B981', background: 'rgba(16,185,129,0.15)' }}>✓ Available</span>
            </div>
            <div className="auth-prop">
              <div className="auth-prop-left">
                <span style={{ fontSize: 22 }}>🌿</span>
                <div>
                  <strong>Kaveri River Retreat</strong>
                  <small>Coorg · ★ 5.0</small>
                </div>
              </div>
              <span className="auth-prop-badge" style={{ color: '#FBBF24', background: 'rgba(251,191,36,0.15)' }}>3 Rooms Left</span>
            </div>
          </div>

          <div className="auth-trust">
            <span>✓ VERIFIED PROPERTIES</span>
            <span>✓ SECURE PAYMENT</span>
            <span>✓ 24/7 CONCIERGE</span>
          </div>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-box">
          <div className="auth-mobile-brand">
            <div className="auth-brand-mark">🏨</div>
            <div className="auth-brand-name">Kaveri <span>Stays</span></div>
          </div>

          <div className="auth-tabs">
            <button type="button" className={tab === 'login' ? 'is-on' : ''} onClick={() => switchTab('login')}>Sign In</button>
            <button type="button" className={tab === 'register' ? 'is-on' : ''} onClick={() => switchTab('register')}>Create Account</button>
          </div>

          <div className="auth-card">
            {error && (
              <div className="auth-error">
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {tab === 'login' ? (
              <>
                <h2>Welcome Back</h2>
                <p className="auth-lead">Sign in to continue your journey.</p>
                <form className="auth-form" onSubmit={handleLoginSubmit}>
                  <Field id="log-email" label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} icon={Mail} required placeholder="you@example.com" />
                  <Field id="log-pwd" label="Password" type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPwd(e.target.value)} icon={Lock} required placeholder="••••••••••" rightNode={eye} />
                  <div className="auth-row">
                    <label className="auth-check">
                      <input type="checkbox" checked={rememberMe} onChange={() => setRememberMe(v => !v)} />
                      Remember me
                    </label>
                    <button type="button" className="auth-link" onClick={() => setShowForgot(true)}>Forgot password?</button>
                  </div>
                  <button type="submit" className={`auth-submit${success ? ' is-ok' : ''}`} disabled={loading || success}>
                    {success ? <><Check size={16} strokeWidth={3} /> Signed In!</> : loading ? <span className="auth-spin" /> : <>Sign In <ArrowRight size={15} /></>}
                  </button>
                </form>
                <div className="auth-or">or continue with</div>
                <div className="auth-social">
                  {['Google', 'Apple', 'Microsoft'].map(label => (
                    <button key={label} type="button" onClick={() => toast.info(`${label} auth is unavailable in this environment.`)}>
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2>Create Account</h2>
                <p className="auth-lead">Join the Kaveri Stays network today.</p>
                <form className="auth-form" onSubmit={handleRegisterSubmit}>
                  <Field id="reg-name" label="Full Name" value={name} onChange={e => setName(e.target.value)} icon={User} required placeholder="Arjun Sharma" />
                  <Field id="reg-email" label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} icon={Mail} required placeholder="you@example.com" />
                  <Field id="reg-phone" label="Phone (optional)" type="tel" value={phone} onChange={e => setPhone(e.target.value)} icon={Phone} placeholder="+91 98765 43210" />
                  <Field id="reg-pwd" label="Password" type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPwd(e.target.value)} icon={Lock} required placeholder="Min 10 characters" rightNode={eye} />
                  {password && (
                    <div className="auth-strength">
                      <div className="auth-strength-meta" style={{ color: ps.color }}>
                        <span>Strength: {ps.label}</span>
                        <span style={{ color: '#64748b' }}>{password.length} chars</span>
                      </div>
                      <div className="auth-bars">
                        {[1, 2, 3, 4].map(i => (
                          <span key={i} style={{ background: i <= ps.score ? ps.color : undefined }} />
                        ))}
                      </div>
                    </div>
                  )}
                  <Field id="reg-confirm" label="Confirm Password" type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} icon={Lock} required placeholder="Re-enter password" />
                  <div className="auth-legal">
                    <label className="auth-check">
                      <input type="checkbox" checked={agreeTerms} onChange={() => setAgreeTerms(v => !v)} />
                      <span>I agree to the <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</span>
                    </label>
                    <label className="auth-check">
                      <input type="checkbox" checked={newsletter} onChange={() => setNewsletter(v => !v)} />
                      Subscribe to exclusive newsletter for premium travel deals.
                    </label>
                  </div>
                  <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? <span className="auth-spin" /> : <>Create Account <ArrowRight size={15} /></>}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="auth-foot">
            {tab === 'login' ? (
              <>No account? <button type="button" className="auth-link" onClick={() => switchTab('register')}>Create one free</button></>
            ) : (
              <>Already have an account? <button type="button" className="auth-link" onClick={() => switchTab('login')}>Sign in</button></>
            )}
          </p>
        </div>
      </main>

      {showForgot && (
        <div className="auth-modal-bg" onClick={() => setShowForgot(false)}>
          <div className="auth-modal" onClick={e => e.stopPropagation()}>
            <div className="auth-modal-bar" />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
              <div className="auth-brand-mark" style={{ width: 40, height: 40, fontSize: 0, background: 'rgba(245,197,66,0.12)' }}>
                <Shield size={18} color="#f5c542" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18 }}>Forgot Password</h3>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>We will send recovery instructions.</p>
              </div>
            </div>
            {forgotSent ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                <strong>Check Your Inbox</strong>
                <p style={{ color: '#64748b', fontSize: 13, marginTop: 6 }}>Instructions sent to <span style={{ color: '#f5c542' }}>{forgotEmail}</span></p>
              </div>
            ) : (
              <form className="auth-form" onSubmit={handleForgotSubmit}>
                <Field id="forgot-email" label="Email Address" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} icon={Mail} required placeholder="you@example.com" />
                <div className="auth-modal-actions">
                  <button type="button" className="auth-ghost" onClick={() => setShowForgot(false)}>Cancel</button>
                  <button type="submit" className="auth-submit" style={{ marginTop: 0 }}>Send Instructions</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

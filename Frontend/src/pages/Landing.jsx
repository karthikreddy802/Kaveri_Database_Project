/**
 * Kaveri Stays — Landing Page
 * World-class luxury hospitality landing experience.
 * Integrates with existing auth, routing, and booking engine.
 */
import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import API from '../api'
import './Landing.css'

// ── STATIC DATA ─────────────────────────────────────────────────────────────

const FACILITIES = [
  { icon: '📶', name: 'Free Wi-Fi' },
  { icon: '🛎️', name: '24/7 Reception' },
  { icon: '🚗', name: 'Free Parking' },
  { icon: '🍽️', name: 'Restaurant' },
  { icon: '🏊', name: 'Swimming Pool' },
  { icon: '🏋️', name: 'Fitness Centre' },
  { icon: '🛁', name: 'Luxury Spa' },
  { icon: '🎥', name: 'Conference Hall' },
  { icon: '🛏️', name: 'Room Service' },
  { icon: '👕', name: 'Laundry' },
  { icon: '🧹', name: 'Housekeeping' },
  { icon: '❄️', name: 'Air Conditioning' },
  { icon: '🔒', name: 'Security' },
  { icon: '🛗', name: 'Elevator' },
]

const WHY_ITEMS = [
  { icon: '✅', title: 'Verified Properties', desc: 'Every property is personally inspected and verified before listing.' },
  { icon: '💳', title: 'Secure Payments', desc: 'SSL-encrypted transactions with PCI-compliant payment processing.' },
  { icon: '⚡', title: 'Instant Booking', desc: 'Real-time room availability and instant booking confirmation.' },
  { icon: '🌟', title: 'Luxury at Scale', desc: 'Premium amenities at affordable prices across all properties.' },
  { icon: '📞', title: '24/7 Support', desc: 'Round-the-clock customer service, always ready to help.' },
  { icon: '🏆', title: 'Trusted Hospitality', desc: 'Thousands of happy guests and growing every day.' },
]

const PAYMENTS = [
  { icon: '📱', name: 'UPI' },
  { icon: '💳', name: 'Credit Card' },
  { icon: '🏧', name: 'Debit Card' },
  { icon: '🏦', name: 'Net Banking' },
  { icon: '💵', name: 'Cash' },
  { icon: '👛', name: 'Wallets' },
  { icon: '📷', name: 'QR Code' },
  { icon: '🔐', name: 'Secure Gateway' },
]

const STEPS = [
  { icon: '🔍', num: '01', title: 'Search Property', desc: 'Browse our curated hotels and check real-time availability.' },
  { icon: '🛏️', num: '02', title: 'Choose Room', desc: 'Pick from a variety of room types that suit your needs.' },
  { icon: '📝', num: '03', title: 'Book Online', desc: 'Confirm your reservation in seconds, no phone calls needed.' },
  { icon: '💰', num: '04', title: 'Secure Payment', desc: 'Pay safely via UPI, card, or cash at check-in.' },
  { icon: '✉️', num: '05', title: 'Confirmation', desc: 'Receive instant booking confirmation with all details.' },
  { icon: '🏨', num: '06', title: 'Check In', desc: 'Arrive and enjoy a seamless, warm check-in experience.' },
]

const REVIEWS = [
  {
    name: 'Aarav Sharma',
    init: 'AS',
    rating: 5,
    location: 'Mumbai',
    date: 'July 2026',
    text: 'Absolutely stunning stay! The rooms were immaculate, staff incredibly warm. The online booking made everything effortless. Kaveri Stays has redefined luxury for me.',
  },
  {
    name: 'Anita Desai',
    init: 'AD',
    rating: 5,
    location: 'Pune',
    date: 'June 2026',
    text: 'From booking to check-out, the entire experience was flawless. The property was exactly as shown. Highly recommend to anyone looking for premium hospitality.',
  },
  {
    name: 'Kavya Nair',
    init: 'KN',
    rating: 5,
    location: 'Bangalore',
    date: 'August 2026',
    text: "The best hotel experience I've had in India. Clean, beautiful, peaceful. The UPI payment system is so smooth. Will definitely be back for my next trip.",
  },
]

const STARS = (n) => Array.from({ length: n }, (_, i) => (
  <span key={i} style={{ color: '#f5c842', fontSize: 16 }}>★</span>
))

// ── COMPONENTS ───────────────────────────────────────────────────────────────

function NavBar({ account }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  return (
    <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`} aria-label="Main navigation">
      <div className="lp-nav-inner">
        {/* Logo */}
        <Link to="/landing" className="lp-logo" aria-label="Kaveri Stays home">
          <div className="lp-logo-icon">🏨</div>
          <span className="lp-logo-text">Kaveri <span>Stays</span></span>
        </Link>

        {/* Nav Links */}
        <ul className="lp-nav-links" role="list">
          {[
            ['home', 'Home'],
            ['properties', 'Properties'],
            ['facilities', 'Facilities'],
            ['payments', 'Payments'],
            ['about', 'About'],
            ['contact', 'Contact'],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollTo(id) }}>
                {label}
              </a>
            </li>
          ))}
        </ul>

        {/* CTAs */}
        <div className="lp-nav-ctas">
          {account ? (
            <button
              className="lp-nav-register"
              onClick={() => navigate('/')}
              aria-label="Go to dashboard"
            >
              Dashboard →
            </button>
          ) : (
            <>
              <Link to="/login" className="lp-nav-login">Sign In</Link>
              <Link to="/login" className="lp-nav-register">Get Started</Link>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button
          className="lp-hamburger lp-btn lp-btn-outline"
          style={{ padding: '8px 12px', fontSize: 20 }}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{
          background: 'rgba(5,10,24,0.97)', backdropFilter: 'blur(24px)',
          padding: '16px 24px 24px', borderTop: '1px solid rgba(255,255,255,0.07)'
        }}>
          {[['home','Home'],['properties','Properties'],['facilities','Facilities'],
            ['payments','Payments'],['about','About'],['contact','Contact']
          ].map(([id, label]) => (
            <a key={id} href={`#${id}`}
              onClick={(e) => { e.preventDefault(); scrollTo(id) }}
              style={{ display: 'block', padding: '12px 0', color: 'rgba(255,255,255,0.8)',
                       fontSize: 16, fontWeight: 500, textDecoration: 'none',
                       borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              {label}
            </a>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            {account
              ? <button className="lp-btn lp-btn-gold" style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => navigate('/')}>Dashboard →</button>
              : <>
                  <Link to="/login" className="lp-btn lp-btn-outline" style={{ flex: 1, justifyContent: 'center' }}>Sign In</Link>
                  <Link to="/login" className="lp-btn lp-btn-gold" style={{ flex: 1, justifyContent: 'center' }}>Register</Link>
                </>
            }
          </div>
        </div>
      )}
    </nav>
  )
}

function HeroSection({ navigate }) {
  const particles = Array.from({ length: 12 }, (_, i) => ({
    left: `${8 + i * 7.5}%`,
    top: `${20 + (i % 4) * 20}%`,
    delay: `${i * 0.5}s`,
  }))

  return (
    <section className="lp-hero" id="home" aria-label="Hero section">
      {/* Background */}
      <div className="lp-hero-bg">
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #050a18 0%, #0a1628 40%, #0f2044 70%, #1a3a6e 100%)'
        }} />
        {/* Floating orbs */}
        <div style={{
          position: 'absolute', top: '20%', right: '10%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,168,71,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '5%',
          width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(26,58,110,0.5) 0%, transparent 70%)',
          filter: 'blur(40px)'
        }} />
      </div>

      {/* Particles */}
      <div className="lp-hero-particles" aria-hidden="true">
        {particles.map((p, i) => (
          <div key={i} className="lp-particle" style={{
            left: p.left, top: p.top, animationDelay: p.delay,
            width: i % 3 === 0 ? 3 : 2, height: i % 3 === 0 ? 3 : 2
          }} />
        ))}
      </div>

      <div className="lp-hero-content">
        {/* Badge */}
        <div className="lp-hero-badge" role="status">
          <span className="dot" aria-hidden="true" />
          Premium Hotel Booking Platform
        </div>

        {/* Headline */}
        <h1 className="lp-hero-h1">
          Experience Comfort<br />
          <span className="gold">Beyond Expectations</span>
        </h1>

        {/* Subtitle */}
        <p className="lp-hero-sub">
          Book your perfect stay with Kaveri Stays. Discover handpicked luxury hotels, real-time availability and secure instant bookings.
        </p>

        {/* Trust */}
        <div className="lp-hero-trust" aria-label="Trust indicators">
          {[['✓', 'Trusted'], ['🔒', 'Secure'], ['🏆', 'Comfortable']].map(([icon, label]) => (
            <div key={label} className="lp-trust-item">
              <span aria-hidden="true">{icon}</span> {label}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="lp-hero-ctas">
          <button
            id="hero-book-btn"
            className="lp-btn lp-btn-gold"
            onClick={() => navigate('/login')}
            aria-label="Book a room now"
          >
            🏨 Book Now
          </button>
          <button
            id="hero-explore-btn"
            className="lp-btn lp-btn-outline"
            onClick={() => document.getElementById('properties')?.scrollIntoView({ behavior: 'smooth' })}
            aria-label="Explore properties"
          >
            Explore Properties ↓
          </button>
        </div>

        {/* Stats */}
        <div className="lp-hero-stats" aria-label="Key statistics">
          {[
            ['3+', 'Properties'],
            ['500+', 'Happy Guests'],
            ['1000+', 'Bookings Done'],
            ['5★', 'Avg Rating'],
          ].map(([num, label]) => (
            <div key={label}>
              <div className="lp-stat-num" aria-label={`${num} ${label}`}>{num}</div>
              <div className="lp-stat-label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function PropertiesSection({ navigate }) {
  const [properties, setProperties] = useState([])
  const EMOJIS = ['🏰', '🏨', '🏩']
  const DESCS = [
    'An iconic luxury property nestled in the heart of the city, offering world-class amenities and breathtaking views.',
    'A modern boutique hotel with contemporary design, premium rooms, and unparalleled hospitality.',
    'A serene riverside retreat blending nature and luxury, perfect for relaxation and rejuvenation.',
  ]
  const TAGS = [
    ['Luxury Suite', 'Pool View', 'City Centre'],
    ['Business Ready', 'Modern Spa', 'Fine Dining'],
    ['River View', 'Nature Trail', 'Boutique'],
  ]

  useEffect(() => {
    API.get('/properties')
      .then(r => setProperties(r.data.items || []))
      .catch(() => {})
  }, [])

  return (
    <section className="lp-section lp-section-navy2" id="properties" aria-labelledby="props-heading">
      <div className="lp-container">
        <div className="lp-text-center">
          <div className="lp-eyebrow" aria-hidden="true">Our Portfolio</div>
          <h2 className="lp-h2" id="props-heading">
            Handpicked <span>Luxury Properties</span>
          </h2>
          <p className="lp-sub">
            Every property in our collection is curated for excellence — from heritage palaces to modern boutique hotels.
          </p>
        </div>

        <div className="lp-props-grid" role="list" aria-label="Available properties">
          {(properties.length ? properties : [
            { id: 1, name: 'Kaveri Grand Palace', city: 'Mysore', stars: 5 },
            { id: 2, name: 'Kaveri City Suites', city: 'Bangalore', stars: 4 },
            { id: 3, name: 'Kaveri River Retreat', city: 'Coorg', stars: 5 },
          ]).map((p, idx) => (
            <article key={p.id} className="lp-prop-card" role="listitem" aria-label={`${p.name} property`}>
              <div className="lp-prop-img-placeholder" aria-hidden="true">
                {EMOJIS[idx % EMOJIS.length]}
              </div>
              <div className="lp-prop-body">
                <div className="lp-prop-stars" aria-label={`${p.stars || 5} stars`}>
                  {STARS(p.stars || 5)}
                </div>
                <div className="lp-prop-name">{p.name}</div>
                <div className="lp-prop-city">
                  <span aria-hidden="true">📍</span> {p.city}
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, marginBottom: 16 }}>
                  {DESCS[idx % DESCS.length]}
                </p>
                <div className="lp-prop-features" role="list" aria-label="Property features">
                  {(TAGS[idx % TAGS.length]).map(t => (
                    <span key={t} className="lp-prop-tag" role="listitem">{t}</span>
                  ))}
                </div>
                <div className="lp-prop-footer">
                  <div>
                    <div className="lp-prop-price">₹2,499</div>
                    <div className="lp-prop-price-label">per night onwards</div>
                  </div>
                  <button
                    className="lp-btn lp-btn-gold"
                    style={{ padding: '10px 22px', fontSize: 14 }}
                    onClick={() => navigate('/login')}
                    aria-label={`Book ${p.name}`}
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function FacilitiesSection() {
  return (
    <section className="lp-section lp-section-dark" id="facilities" aria-labelledby="fac-heading">
      <div className="lp-container">
        <div className="lp-text-center">
          <div className="lp-eyebrow" aria-hidden="true">World-Class</div>
          <h2 className="lp-h2" id="fac-heading">
            Premium <span>Facilities</span>
          </h2>
          <p className="lp-sub">
            Every amenity thoughtfully designed to make your stay extraordinary.
          </p>
        </div>
        <div className="lp-fac-grid" role="list" aria-label="Available facilities">
          {FACILITIES.map(f => (
            <div key={f.name} className="lp-fac-card" role="listitem">
              <span className="lp-fac-icon" aria-hidden="true">{f.icon}</span>
              <div className="lp-fac-name">{f.name}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function WhySection() {
  return (
    <section className="lp-section lp-section-navy2" id="why" aria-labelledby="why-heading">
      <div className="lp-container">
        <div className="lp-why-grid">
          {/* Left — text */}
          <div>
            <div className="lp-eyebrow" aria-hidden="true">Why Us</div>
            <h2 className="lp-h2" id="why-heading">
              Why Choose <span>Kaveri Stays?</span>
            </h2>
            <p className="lp-sub" style={{ marginBottom: 36 }}>
              We go beyond a booking platform — we craft memorable hospitality experiences.
            </p>
            <div className="lp-why-list" role="list">
              {WHY_ITEMS.map(item => (
                <div key={item.title} className="lp-why-item" role="listitem">
                  <div className="lp-why-icon" aria-hidden="true">{item.icon}</div>
                  <div className="lp-why-text">
                    <h4>{item.title}</h4>
                    <p>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — visual */}
          <div className="lp-why-visual" aria-hidden="true">
            <div className="lp-why-card-stack">
              <div className="lp-why-main-card">
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 8 }}>
                    Guest Experience
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Exceptional</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Across all our properties</div>
                </div>
              </div>
              <div className="lp-why-float-card">
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  Latest Booking
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #f5c842, #d4a847)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏨</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Grand Palace</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>2 nights · ₹4,998</div>
                  </div>
                </div>
                <div style={{ marginTop: 14, padding: '8px 12px', background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#4ade80' }}>
                  ✓ Confirmed
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function PaymentSection() {
  return (
    <section className="lp-section lp-section-light" id="payments" aria-labelledby="pay-heading">
      <div className="lp-container">
        <div className="lp-text-center">
          <div className="lp-eyebrow" aria-hidden="true">Payments</div>
          <h2 className="lp-h2 lp-h2-light" id="pay-heading">
            Flexible <span>Payment Options</span>
          </h2>
          <p className="lp-sub lp-sub-dark" style={{ margin: '0 auto' }}>
            Pay the way you prefer — we support all major payment methods with bank-grade security.
          </p>
        </div>

        <div className="lp-pay-grid" role="list" aria-label="Accepted payment methods">
          {PAYMENTS.map(p => (
            <div key={p.name} className="lp-pay-card" role="listitem">
              <span className="lp-pay-icon" aria-hidden="true">{p.icon}</span>
              <div className="lp-pay-name">{p.name}</div>
            </div>
          ))}
        </div>

        <div className="lp-pay-security" role="list" aria-label="Security certifications">
          {[
            ['🔐', 'SSL Encrypted'],
            ['🛡️', 'PCI Compliant'],
            ['✅', 'RBI Regulated'],
            ['🔒', 'Secure Gateway'],
            ['📱', 'OTP Verified'],
          ].map(([icon, label]) => (
            <div key={label} className="lp-pay-sec-item" role="listitem">
              <span aria-hidden="true">{icon}</span> {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function BookingStepsSection() {
  return (
    <section className="lp-section lp-section-dark" id="booking-steps" aria-labelledby="steps-heading">
      <div className="lp-container">
        <div className="lp-text-center">
          <div className="lp-eyebrow" aria-hidden="true">Simple Process</div>
          <h2 className="lp-h2" id="steps-heading">
            Book in <span>6 Easy Steps</span>
          </h2>
          <p className="lp-sub">
            From search to check-in — your perfect stay is just a few clicks away.
          </p>
        </div>

        <ol className="lp-steps-row" aria-label="Booking process steps">
          {STEPS.map((step) => (
            <li key={step.num} className="lp-step">
              <div className="lp-step-circle" aria-hidden="true">{step.icon}</div>
              <div className="lp-step-num" aria-label={`Step ${step.num}`}>STEP {step.num}</div>
              <div className="lp-step-title">{step.title}</div>
              <p className="lp-step-desc">{step.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function ReviewsSection() {
  return (
    <section className="lp-section lp-section-light" id="reviews" aria-labelledby="reviews-heading">
      <div className="lp-container">
        <div className="lp-text-center">
          <div className="lp-eyebrow" aria-hidden="true">Testimonials</div>
          <h2 className="lp-h2 lp-h2-light" id="reviews-heading">
            What Our <span>Guests Say</span>
          </h2>
          <p className="lp-sub lp-sub-dark" style={{ margin: '0 auto' }}>
            Real experiences from real guests who chose Kaveri Stays.
          </p>
        </div>

        <div className="lp-reviews-grid" role="list" aria-label="Guest reviews">
          {REVIEWS.map((r) => (
            <article key={r.name} className="lp-review-card" role="listitem" aria-label={`Review by ${r.name}`}>
              <div className="lp-review-stars" aria-label={`${r.rating} out of 5 stars`}>
                {STARS(r.rating)}
              </div>
              <p className="lp-review-text">"{r.text}"</p>
              <div className="lp-review-author">
                <div className="lp-review-avatar" aria-hidden="true">{r.init}</div>
                <div>
                  <div className="lp-review-name">{r.name}</div>
                  <div className="lp-review-meta">{r.location} · {r.date}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function AboutSection() {
  return (
    <section className="lp-section lp-section-dark" id="about" aria-labelledby="about-heading">
      <div className="lp-container">
        <div className="lp-about-grid">
          {/* Left */}
          <div>
            <div className="lp-eyebrow" aria-hidden="true">Our Story</div>
            <h2 className="lp-h2" id="about-heading">
              About <span>Kaveri Stays</span>
            </h2>
            <p className="lp-sub" style={{ marginBottom: 24 }}>
              Kaveri Stays was born from a vision to make luxury hospitality accessible to every traveller in India. We believe a great stay can transform your journey.
            </p>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', lineHeight: 1.85 }}>
              We connect guests with premium verified hotels, offering seamless digital booking, transparent pricing, and genuine warm hospitality — powered by modern technology and driven by a passion for guest experience.
            </p>
            <div className="lp-about-pillars" role="list" aria-label="Our pillars">
              {[
                { icon: '🎯', title: 'Our Mission', text: 'Make luxury stays accessible and effortless for every traveller.' },
                { icon: '🌟', title: 'Our Vision', text: 'Become India\'s most trusted hospitality technology platform.' },
                { icon: '🤝', title: 'Our Commitment', text: 'Verified quality, secure bookings, and genuine hospitality always.' },
                { icon: '💡', title: 'Technology', text: 'Real-time inventory, smart pricing and seamless digital experience.' },
              ].map(p => (
                <div key={p.title} className="lp-pillar" role="listitem">
                  <div className="lp-pillar-icon" aria-hidden="true">{p.icon}</div>
                  <div className="lp-pillar-title">{p.title}</div>
                  <p className="lp-pillar-text">{p.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Visual */}
          <div className="lp-about-image" aria-hidden="true">
            <div className="lp-about-img-card">🏨</div>
            <div className="lp-about-badge">
              <div className="num">3+</div>
              <div className="label">Luxury Properties</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ContactSection() {
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [sent, setSent] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    setSent(true)
    setTimeout(() => setSent(false), 4000)
    setForm({ name: '', email: '', message: '' })
  }

  return (
    <section className="lp-section lp-section-navy2" id="contact" aria-labelledby="contact-heading">
      <div className="lp-container">
        <div className="lp-text-center">
          <div className="lp-eyebrow" aria-hidden="true">Get In Touch</div>
          <h2 className="lp-h2" id="contact-heading">
            Contact <span>Us</span>
          </h2>
          <p className="lp-sub">
            Have a question or need help? Our team is always ready to assist you.
          </p>
        </div>

        <div className="lp-contact-grid">
          {/* Info */}
          <div className="lp-contact-info" aria-label="Contact information">
            {[
              { icon: '📍', label: 'Address', val: '12, Kaveri Towers, MG Road, Bangalore — 560001' },
              { icon: '📞', label: 'Phone', val: '+91 80 1234 5678' },
              { icon: '✉️', label: 'Email', val: 'hello@kaveristays.in' },
              { icon: '🕐', label: 'Hours', val: '24/7 — We never close' },
            ].map(item => (
              <div key={item.label} className="lp-contact-item">
                <div className="lp-contact-icon" aria-hidden="true">{item.icon}</div>
                <div>
                  <div className="lp-contact-label">{item.label}</div>
                  <div className="lp-contact-val">{item.val}</div>
                </div>
              </div>
            ))}

            {/* Map placeholder */}
            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, height: 160, display: 'flex', alignItems: 'center',
              justifyContent: 'center', flexDirection: 'column', gap: 8, marginTop: 8
            }} aria-label="Map placeholder">
              <span style={{ fontSize: 36 }}>🗺️</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Interactive Map — Bangalore, India</span>
            </div>
          </div>

          {/* Form */}
          <form className="lp-contact-form" onSubmit={handleSubmit} aria-label="Contact form" noValidate>
            <input
              id="contact-name"
              className="lp-input"
              type="text"
              placeholder="Your Full Name"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              aria-label="Full name"
            />
            <input
              id="contact-email"
              className="lp-input"
              type="email"
              placeholder="Your Email Address"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
              aria-label="Email address"
            />
            <textarea
              id="contact-message"
              className="lp-input lp-textarea"
              placeholder="Your message…"
              value={form.message}
              onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              required
              aria-label="Message"
            />
            <button
              id="contact-submit-btn"
              type="submit"
              className="lp-btn lp-btn-gold"
              style={{ alignSelf: 'flex-start' }}
            >
              {sent ? '✓ Message Sent!' : '📤 Send Message'}
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="lp-footer" aria-label="Site footer">
      <div className="lp-footer-grid">
        {/* Brand */}
        <div className="lp-footer-brand">
          <div className="lp-logo" style={{ display: 'inline-flex' }}>
            <div className="lp-logo-icon">🏨</div>
            <span className="lp-logo-text">Kaveri <span>Stays</span></span>
          </div>
          <p>
            India's premium hotel management and booking platform. We bring luxury hospitality and technology together.
          </p>
          <div className="lp-footer-social" aria-label="Social media links">
            {['𝕏', 'in', 'f', '▶'].map((s, i) => (
              <div key={i} className="lp-social-btn" role="button" tabIndex={0} aria-label={`Social link ${i + 1}`}>{s}</div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <nav aria-label="Quick links">
          <div className="lp-footer-col">
            <h4>Quick Links</h4>
            {[['#home','Home'],['#properties','Properties'],['#facilities','Facilities'],['#about','About'],['#contact','Contact']].map(([href, label]) => (
              <a key={href} href={href}>{label}</a>
            ))}
          </div>
        </nav>

        {/* Account */}
        <nav aria-label="Account links">
          <div className="lp-footer-col">
            <h4>Account</h4>
            <Link to="/login">Sign In</Link>
            <Link to="/login">Register</Link>
            <Link to="/">Dashboard</Link>
            <Link to="/bookings">My Bookings</Link>
          </div>
        </nav>

        {/* Legal */}
        <nav aria-label="Legal links">
          <div className="lp-footer-col">
            <h4>Legal</h4>
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
            <a href="#refund">Refund Policy</a>
            <a href="#faq">FAQ</a>
          </div>
        </nav>
      </div>

      <div className="lp-footer-bottom">
        <p className="lp-footer-copy">
          © {new Date().getFullYear()} Kaveri Stays. All rights reserved.
        </p>
        <div className="lp-footer-legal">
          <a href="#privacy">Privacy</a>
          <a href="#terms">Terms</a>
          <a href="#refund">Refund</a>
        </div>
      </div>
    </footer>
  )
}

// ── MAIN LANDING PAGE ─────────────────────────────────────────────────────────

export default function Landing() {
  const { account } = useAuth()
  const navigate = useNavigate()

  // Scroll reveal — simple IntersectionObserver
  useEffect(() => {
    const els = document.querySelectorAll('.lp-section')
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('lp-visible')
      }),
      { threshold: 0.08 }
    )
    els.forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [])

  return (
    <div className="landing-root" lang="en">
      {/* SEO Meta (handled in index.html, but you can add react-helmet here) */}

      <NavBar account={account} />

      <main id="main-content">
        <HeroSection navigate={navigate} />
        <PropertiesSection navigate={navigate} />
        <FacilitiesSection />
        <WhySection />
        <PaymentSection />
        <BookingStepsSection />
        <ReviewsSection />
        <AboutSection />
        <ContactSection />
      </main>

      <Footer />
    </div>
  )
}

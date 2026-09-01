import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context'
import {
  LayoutDashboard, BookOpen, Users, CreditCard,
  Star, BarChart2, Building2, LogOut, Hotel
} from 'lucide-react'

const NAV = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard',  section: 'MAIN' },
  { to: '/bookings',    icon: BookOpen,         label: 'Bookings',   section: 'MAIN' },
  { to: '/guests',      icon: Users,            label: 'Guests',     section: 'MAIN' },
  { to: '/payments',    icon: CreditCard,        label: 'Payments',   section: 'MAIN' },
  { to: '/reviews',     icon: Star,             label: 'Reviews',    section: 'MAIN' },
  { to: '/properties',  icon: Building2,         label: 'Properties', section: 'EXPLORE' },
  { to: '/reports',     icon: BarChart2,         label: 'Reports',    section: 'ANALYTICS' },
]

const ROLE_HIDDEN = {
  guest:   ['/guests', '/reports'],
  staff:   ['/reports'],
  manager: [],
  owner:   [],
}

export default function Layout({ children }) {
  const { account, logout } = useAuth()
  const navigate = useNavigate()

  const hidden = ROLE_HIDDEN[account?.role] || []
  const visible = NAV.filter(n => !hidden.includes(n.to))

  const sections = [...new Set(visible.map(n => n.section))]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const initials = account?.full_name
    ? account.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : account?.email?.[0]?.toUpperCase() ?? '?'

  return (
    <div className="app-layout">
      {/* ── TOP BAR ── */}
      <header className="app-topbar">
        <div className="brand">
          <div className="brand-icon">🏨</div>
          <div>
            <div className="brand-name">Kaveri Stays</div>
            <div className="brand-sub">Hotel Management</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className={`topbar-role-badge role-${account?.role}`}>
            {account?.role}
          </span>
          <div className="topbar-avatar" title={account?.full_name || account?.email}>
            {initials}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout} title="Logout">
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <aside className="app-sidebar">
        {sections.map(sec => (
          <div key={sec}>
            <div className="nav-section-label">{sec}</div>
            {visible.filter(n => n.section === sec).map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <Icon size={16} className="nav-icon" />
                {label}
              </NavLink>
            ))}
          </div>
        ))}

        <div style={{ position: 'absolute', bottom: 16, left: 8, right: 8 }}>
          <div className="nav-item" onClick={handleLogout} style={{ color: 'var(--rose)', cursor: 'pointer' }}>
            <LogOut size={16} />
            Sign out
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="app-main animate-fade">
        {children}
      </main>
    </div>
  )
}

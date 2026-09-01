import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, ToastProvider, useAuth } from './context'
import Layout from './components/Layout'
import Landing    from './pages/Landing'
import Login      from './pages/Login'
import Dashboard  from './pages/Dashboard'
import Bookings   from './pages/Bookings'
import Guests     from './pages/Guests'
import Payments   from './pages/Payments'
import Reviews    from './pages/Reviews'
import Properties from './pages/Properties'
import Reports    from './pages/Reports'

function PrivateRoute({ children, roles }) {
  const { account } = useAuth()
  if (!account) return <Navigate to="/landing" replace />
  if (roles && !roles.includes(account.role)) return <Navigate to="/" replace />
  return <Layout>{children}</Layout>
}

function PublicRoute({ children }) {
  const { account } = useAuth()
  if (account) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── Public landing page — default entry point ── */}
      <Route path="/landing" element={<Landing />} />

      {/* ── Auth — redirect to dashboard if already logged in ── */}
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

      {/* ── Protected app routes ── */}
      <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/bookings" element={<PrivateRoute><Bookings /></PrivateRoute>} />
      <Route path="/payments" element={<PrivateRoute><Payments /></PrivateRoute>} />
      <Route path="/reviews"  element={<PrivateRoute><Reviews /></PrivateRoute>} />
      <Route path="/properties" element={<PrivateRoute><Properties /></PrivateRoute>} />

      <Route path="/guests" element={
        <PrivateRoute roles={['staff', 'manager', 'owner']}>
          <Guests />
        </PrivateRoute>
      } />

      <Route path="/reports" element={
        <PrivateRoute roles={['manager', 'owner']}>
          <Reports />
        </PrivateRoute>
      } />

      {/* ── Catch-all: unauthenticated → landing, authenticated → dashboard ── */}
      <Route path="*" element={<Navigate to="/landing" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

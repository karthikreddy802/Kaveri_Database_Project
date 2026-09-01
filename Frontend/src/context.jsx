import { createContext, useContext, useState, useCallback } from 'react'

// ── Auth Context ──────────────────────────────────────────────────────────────
const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('account')) } catch { return null }
  })

  const login = useCallback((accountData, tokens) => {
    localStorage.setItem('access_token',  tokens.access_token)
    localStorage.setItem('refresh_token', tokens.refresh_token)
    localStorage.setItem('account', JSON.stringify(accountData))
    setAccount(accountData)
  }, [])

  const logout = useCallback(async () => {
    try {
      const API = (await import('./api.js')).default
      const refresh_token = localStorage.getItem('refresh_token')
      if (refresh_token) await API.post('/auth/logout', { refresh_token })
    } catch {}
    localStorage.clear()
    setAccount(null)
  }, [])

  return <AuthCtx.Provider value={{ account, login, logout }}>{children}</AuthCtx.Provider>
}

export const useAuth = () => useContext(AuthCtx)

// ── Toast Context ─────────────────────────────────────────────────────────────
const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const add = useCallback((message, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const toast = {
    success: m => add(m, 'success'),
    error:   m => add(m, 'error'),
    info:    m => add(m, 'info'),
    warning: m => add(m, 'warning'),
  }

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type} animate-slide`}>
            <span style={{ fontSize: 16 }}>
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : t.type === 'warning' ? '⚠' : 'ℹ'}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const useToast = () => useContext(ToastCtx)

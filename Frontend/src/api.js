import axios from 'axios'

const API = axios.create({ baseURL: '' })  // Vite proxy routes to localhost:8000

// Attach Bearer token on every request
API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-refresh on 401
let refreshing = false
let queue = []

API.interceptors.response.use(
  r => r,
  async err => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh_token = localStorage.getItem('refresh_token')
      if (!refresh_token) {
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(err)
      }
      if (refreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`
          return API(original)
        })
      }
      refreshing = true
      try {
        const { data } = await axios.post('/auth/refresh', { refresh_token })
        localStorage.setItem('access_token',  data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        queue.forEach(p => p.resolve(data.access_token))
        queue = []
        original.headers.Authorization = `Bearer ${data.access_token}`
        return API(original)
      } catch {
        queue.forEach(p => p.reject())
        queue = []
        localStorage.clear()
        window.location.href = '/login'
        return Promise.reject(err)
      } finally {
        refreshing = false
      }
    }
    return Promise.reject(err)
  }
)

export default API

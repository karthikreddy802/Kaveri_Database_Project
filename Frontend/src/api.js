import axios from 'axios'

const API = axios.create({
  baseURL: '',
  timeout: 15000,
})

const inflight = new Map()

API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  else delete cfg.headers.Authorization

  const method = (cfg.method || 'get').toLowerCase()
  if (method === 'get') {
    const key = `${method}:${cfg.url}:${JSON.stringify(cfg.params || {})}`
    if (inflight.has(key)) {
      cfg.adapter = () => inflight.get(key)
    } else {
      cfg._inflightKey = key
    }
  }
  return cfg
})

API.interceptors.response.use(
  r => {
    const key = r.config?._inflightKey
    if (key) inflight.delete(key)
    return r
  },
  async err => {
    const original = err.config || {}
    const key = original._inflightKey
    if (key) inflight.delete(key)

    const status = err.response?.status
    if (!original || status === 500 || status === 502 || status === 503 || status === 504) {
      return Promise.reject(err)
    }

    if (status === 401 && !original._retry) {
      original._retry = true
      const refresh_token = localStorage.getItem('refresh_token')
      if (!refresh_token) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('account')
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/landing')) {
          window.location.href = '/login'
        }
        return Promise.reject(err)
      }
      try {
        const { data } = await axios.post('/auth/refresh', { refresh_token })
        localStorage.setItem('access_token', data.access_token)
        localStorage.setItem('refresh_token', data.refresh_token)
        original.headers = original.headers || {}
        original.headers.Authorization = `Bearer ${data.access_token}`
        return API(original)
      } catch {
        localStorage.clear()
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/landing')) {
          window.location.href = '/login'
        }
        return Promise.reject(err)
      }
    }
    return Promise.reject(err)
  }
)

const _get = API.get.bind(API)
API.get = (url, config) => {
  const key = `get:${url}:${JSON.stringify(config?.params || {})}`
  if (inflight.has(key)) return inflight.get(key)
  const req = _get(url, config).finally(() => inflight.delete(key))
  inflight.set(key, req)
  return req
}

export default API

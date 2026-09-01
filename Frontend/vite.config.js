import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/auth':       'http://localhost:8000',
      '/me':         'http://localhost:8000',
      '/properties': 'http://localhost:8000',
      '/bookings':   'http://localhost:8000',
      '/guests':     'http://localhost:8000',
      '/reports':    'http://localhost:8000',
    }
  }
})

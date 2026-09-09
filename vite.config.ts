import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sheet-csv': {
        target: 'https://docs.google.com',
        changeOrigin: true,
        rewrite: (path) => {
          const m = path.match(/^\/sheet-csv\/([^/]+)\/([^/?]+)/)
          if (!m?.[1] || !m[2]) return path
          return `/spreadsheets/d/${m[1]}/export?format=csv&gid=${m[2]}`
        },
      },
    },
  },
})

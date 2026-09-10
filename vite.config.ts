import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
// Production hosts on Cloudflare Workers at site root (not GitHub project Pages subpath).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.DEV_SERVER_PORT || 5188)

  return {
    base: '/',
    plugins: [react()],
    server: {
      // Must match Google OAuth Authorized JavaScript origin (see DEV_SERVER_PORT in `.env`).
      port,
      strictPort: true,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
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
  }
})

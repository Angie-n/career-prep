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
      },
    },
  }
})

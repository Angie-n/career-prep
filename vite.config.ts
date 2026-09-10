import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Project Pages live at https://angie-n.github.io/career-prep/ — base must match in production builds.
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/career-prep/' : '/',
  plugins: [react()],
  server: {
    // Must match Google OAuth Authorized JavaScript origin.
    port: 5188,
    strictPort: true,
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
}))

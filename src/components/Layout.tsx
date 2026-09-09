import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CATEGORY_BY_KIND, CATEGORY_LABEL, type Category, type SessionKind } from '../lib/types'
import { useActiveSession, useStore } from '../state/Store'

const links = [
  { to: '/', label: 'Today' },
  { to: '/practice', label: 'Communication' },
  { to: '/applications', label: 'Applications' },
  { to: '/dsa', label: 'DSA' },
  { to: '/goals', label: 'Goals' },
]

function modeFor(path: string, kind?: SessionKind): Category | null {
  if (kind) return CATEGORY_BY_KIND[kind]
  if (path.startsWith('/applications')) return 'applications'
  if (path.startsWith('/dsa')) return 'dsa'
  if (path.startsWith('/practice')) return 'communication'
  return null
}

export function Layout() {
  const location = useLocation()
  const { state } = useStore()
  const active = useActiveSession()
  const historyId = location.pathname.startsWith('/history/') ? location.pathname.slice('/history/'.length) : ''
  const historyKind = historyId ? state.sessions.find((s) => s.id === historyId)?.kind : undefined
  const studio = location.pathname === '/practice' && Boolean(active)
  const mode = modeFor(location.pathname, active?.kind ?? historyKind)
  const classes = ['app-shell']
  if (studio) classes.push('studio')
  if (mode) classes.push(`mode-${mode}`)

  return (
    <div className={classes.join(' ')}>
      <aside className="nav">
        <div className="brand">
          <div>
            <strong>Career Studio</strong>
            <small>{mode ? CATEGORY_LABEL[mode] : 'Practice'}</small>
          </div>
        </div>
        <nav className="nav-links">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-foot">Start. Speak. Don’t drift.</div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { phaseElapsedSec, isPhasePaused } from '../lib/sessionPlan'
import { CATEGORY_BY_KIND, CATEGORY_LABEL, type Category, type SessionKind } from '../lib/types'
import { useStore } from '../state/Store'

const links = [
  { to: '/', label: 'Today', end: true },
  { to: '/active', label: 'Active Sessions', end: false },
  { to: '/practice', label: 'Communication', end: false },
  { to: '/applications', label: 'Applications', end: false },
  { to: '/dsa', label: 'DSA', end: false },
  { to: '/goals', label: 'Goals', end: true },
]

/** Category chrome from the route (and history detail), never from a live session elsewhere. */
function modeFor(
  path: string,
  opts: { historyKind?: SessionKind; activeKind?: SessionKind },
): Category | null {
  if (path.startsWith('/history/') && opts.historyKind) {
    return CATEGORY_BY_KIND[opts.historyKind]
  }
  if (path === '/active' || path.startsWith('/active/')) {
    return opts.activeKind ? CATEGORY_BY_KIND[opts.activeKind] : null
  }
  if (path.startsWith('/applications')) return 'applications'
  if (path.startsWith('/dsa')) return 'dsa'
  if (path.startsWith('/practice')) return 'communication'
  return null
}

function studioSessionId(path: string): string | null {
  if (!path.startsWith('/active/')) return null
  const id = path.slice('/active/'.length).split('/')[0]
  return id || null
}

export function Layout() {
  const location = useLocation()
  const { state, dispatch } = useStore()
  const lastStudioIdRef = useRef<string | null>(null)
  const didInitPauseRef = useRef(false)

  const historyId = location.pathname.startsWith('/history/')
    ? location.pathname.slice('/history/'.length)
    : ''
  const historyKind = historyId ? state.sessions.find((s) => s.id === historyId)?.kind : undefined
  const routeSessionId = studioSessionId(location.pathname)
  const viewing = routeSessionId
    ? state.sessions.find((s) => s.id === routeSessionId && s.inProgress)
    : undefined

  const mode = modeFor(location.pathname, {
    historyKind,
    activeKind: viewing?.kind,
  })
  const classes = ['app-shell']
  if (mode) classes.push(`mode-${mode}`)

  // Leaving a studio (or switching sessions) freezes that session's clock.
  // On first paint outside a studio, freeze any still-running clocks from a prior visit.
  useEffect(() => {
    const nextId = routeSessionId
    const prevId = lastStudioIdRef.current

    const pause = (id: string) => {
      const session = state.sessions.find((s) => s.id === id && s.inProgress)
      if (!session || isPhasePaused(session)) return
      dispatch({
        type: 'patch-session',
        session: {
          ...session,
          phasePausedElapsedSec: phaseElapsedSec(session),
        },
      })
    }

    if (!didInitPauseRef.current) {
      didInitPauseRef.current = true
      if (!nextId) {
        for (const s of state.sessions) {
          if (s.inProgress && !isPhasePaused(s)) pause(s.id)
        }
      }
      lastStudioIdRef.current = nextId
      return
    }

    if (prevId && prevId !== nextId) pause(prevId)
    lastStudioIdRef.current = nextId
  }, [routeSessionId, state.sessions, dispatch])

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
            <NavLink key={l.to} to={l.to} end={l.end}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-foot">Start. Speak. Don’t drift.</div>
      </aside>
      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

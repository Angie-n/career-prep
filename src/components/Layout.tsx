import { useEffect, useId, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { phaseElapsedSec, isPhasePaused } from '../lib/sessionPlan'
import { CATEGORY_BY_KIND, CATEGORY_LABEL, type Category, type SessionKind } from '../lib/types'
import { useStore } from '../state/Store'

const links = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/active', label: 'Active Sessions', end: false },
  { to: '/applications', label: 'Applications', end: false },
  { to: '/practice', label: 'Communication', end: false },
  { to: '/dsa', label: 'Data Structures and Algorithms', end: false },
  { to: '/goals', label: 'Goals', end: true },
  { to: '/account', label: 'Account', end: true },
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

function MenuIcon() {
  return (
    <span className="nav-toggle-bars" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  )
}

export function Layout() {
  const location = useLocation()
  const { state, dispatch } = useStore()
  const lastStudioIdRef = useRef<string | null>(null)
  const didInitPauseRef = useRef(false)
  const navRef = useRef<HTMLElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()

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
  if (menuOpen) classes.push('nav-open')

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

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }

    function onPointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null
      if (target && navRef.current && !navRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
    }
  }, [menuOpen])

  return (
    <div className={classes.join(' ')}>
      <aside className="nav" ref={navRef}>
        <div className="nav-bar">
          <div className="brand">
            <div>
              <strong>Career Studio</strong>
              <small>{mode ? CATEGORY_LABEL[mode] : 'Practice'}</small>
            </div>
          </div>
          <button
            className="nav-toggle"
            type="button"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MenuIcon />
          </button>
        </div>
        <nav className="nav-links" id={menuId}>
          <div className="nav-links-inner">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} onClick={() => setMenuOpen(false)}>
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </aside>
      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

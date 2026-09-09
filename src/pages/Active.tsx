import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect } from 'react'
import { ResumeSessionCard } from '../components/ResumeSessionCard'
import { SessionStudio } from '../components/SessionStudio'
import { activeSessionPath } from '../lib/sessionPlan'
import { CATEGORY_BY_KIND, type Category } from '../lib/types'
import {
  inProgressForCategory,
  inProgressSessions,
  useStore,
} from '../state/Store'

const CATEGORY_QUERY: Record<string, Category> = {
  applications: 'applications',
  communication: 'communication',
  dsa: 'dsa',
}

export function Active() {
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const live = inProgressSessions(state)
  const categoryParam = searchParams.get('category')
  const categoryFilter = categoryParam ? CATEGORY_QUERY[categoryParam] : undefined

  // Deep-link /active?category=dsa → that category's studio when one is live.
  useEffect(() => {
    if (sessionId || !categoryFilter) return
    const match = inProgressForCategory(state, categoryFilter)
    if (match) navigate(activeSessionPath(match.id), { replace: true })
  }, [sessionId, categoryFilter, state, navigate])

  const session = sessionId
    ? state.sessions.find((s) => s.id === sessionId && s.inProgress)
    : undefined

  useEffect(() => {
    if (!session) return
    dispatch({ type: 'focus-session', id: session.id })
  }, [session, dispatch])

  if (session) {
    return <SessionStudio session={session} />
  }

  if (sessionId && !session) {
    return (
      <div className="stack">
        <section className="card quiet">
          <p className="kicker">Active Sessions</p>
          <h1>Session not found</h1>
          <p className="lead">That block is no longer in progress.</p>
          <p className="muted" style={{ marginTop: 12 }}>
            <Link to="/active">All active sessions</Link>
            {' · '}
            <Link to="/">Today</Link>
          </p>
        </section>
      </div>
    )
  }

  if (live.length > 0) {
    const shown = categoryFilter
      ? live.filter((s) => CATEGORY_BY_KIND[s.kind] === categoryFilter)
      : live
    return (
      <div className="stack">
        <div>
          <p className="kicker">Active Sessions</p>
          <h1>{shown.length === 1 ? '1 session in progress' : `${shown.length} sessions in progress`}</h1>
          <p className="lead">Resume a block below — each category can keep one paused session.</p>
        </div>
        {shown.map((s) => (
          <ResumeSessionCard key={s.id} session={s} headingLevel="h2" />
        ))}
        {shown.length === 0 ? (
          <p className="muted">No in-progress session in that category.</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="stack">
      <section className="card quiet">
        <p className="kicker">Active Sessions</p>
        <h1>No active sessions</h1>
        <p className="lead">
          Start a block from Today or a category home — the live studio lives here while you work.
        </p>
        <p className="muted" style={{ marginTop: 12 }}>
          <Link to="/">Today</Link>
          {' · '}
          <Link to="/practice">Communication</Link>
          {' · '}
          <Link to="/applications">Applications</Link>
          {' · '}
          <Link to="/dsa">DSA</Link>
        </p>
      </section>
    </div>
  )
}

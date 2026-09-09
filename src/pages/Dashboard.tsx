import { Link, useNavigate } from 'react-router-dom'
import { StreakCalendar } from '../components/StreakCalendar'
import { minutesToday, neglectedCategories, sessionsOn } from '../lib/insights'
import { todayKey } from '../lib/ids'
import { buildSession, startHref } from '../lib/sessionPlan'
import {
  CATEGORIES,
  CATEGORY_BY_KIND,
  CATEGORY_LABEL,
  SESSION_META,
  durationFor,
  type Category,
  type SessionKind,
} from '../lib/types'
import { useStore } from '../state/Store'

function recommend(neglected: Category): SessionKind {
  if (neglected === 'applications') return 'apps-block'
  if (neglected === 'dsa') return 'dsa-block'
  return 'comm-cold'
}

function hrefFor(category: Category) {
  if (category === 'applications') return '/applications'
  if (category === 'dsa') return '/dsa'
  return '/practice'
}

export function Dashboard() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const today = todayKey()
  const mins = minutesToday(state)
  const neglected = neglectedCategories(state)
  const weak = neglected[0] ?? 'communication'
  const kind = recommend(weak)
  const meta = SESSION_META[kind]
  const count = sessionsOn(state, today).length

  function start() {
    const href = startHref(kind)
    if (href !== '/practice') {
      navigate(href)
      return
    }
    const session = buildSession(kind, state.customQuestions, {
      minutes: durationFor(state.durations, kind),
    })
    dispatch({ type: 'start-session', session })
    navigate('/practice')
  }

  return (
    <div className="stack">
      <div className="hero hero-solo">
        <section className={`card action cat-${CATEGORY_BY_KIND[kind]}`}>
          <p className="kicker">Next</p>
          <h1>{meta.title}</h1>
          <p className="lead">
            {meta.blurb} {durationFor(state.durations, kind)} minutes.
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <button className="btn" type="button" onClick={start}>
              Start
            </button>
            <span className="muted" style={{ fontSize: 13 }}>
              {count === 1 ? '1 session today' : `${count} sessions today`}
            </span>
          </div>
        </section>
      </div>

      <section className="card quiet">
        <p className="kicker">Streaks</p>
        <h2>Goal days by category</h2>
        <div className="streak-grid">
          {CATEGORIES.map((c) => (
            <StreakCalendar key={c} category={c} />
          ))}
        </div>
      </section>

      <section className="card quiet">
        <p className="kicker">Today</p>
        <h2>Time by category</h2>
        {CATEGORIES.map((c) => {
          const have = mins[c]
          const goal = state.goals[c]
          const pct = Math.min(100, (have / Math.max(1, goal)) * 100)
          return (
            <Link className={`goal-row goal-link cat-${c}`} key={c} to={hrefFor(c)}>
              <span>{CATEGORY_LABEL[c]}</span>
              <div className="bar">
                <span style={{ width: `${pct}%` }} />
              </div>
              <span className="num">
                {Math.round(have)}m / {goal}m
              </span>
            </Link>
          )
        })}
      </section>
    </div>
  )
}

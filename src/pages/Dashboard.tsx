import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ResumeSessionCard } from '../components/ResumeSessionCard'
import { StreakCalendar } from '../components/StreakCalendar'
import { CERB, cerbMood } from '../lib/cerb'
import { minutesToday, neglectedCategories, sessionsOn, todayGoalProgressPct } from '../lib/insights'
import { todayKey } from '../lib/ids'
import { activeSessionPath, buildSession, startHref } from '../lib/sessionPlan'
import {
  CATEGORIES,
  CATEGORY_BY_KIND,
  CATEGORY_LABEL,
  SESSION_META,
  durationFor,
  type Category,
  type PracticeSession,
  type SessionKind,
} from '../lib/types'
import { inProgressForKind, useInProgressSessions, useStore } from '../state/Store'

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

type HeroOption = { type: 'resume'; session: PracticeSession } | { type: 'next' }

export function Dashboard() {
  const { state, dispatch } = useStore()
  const live = useInProgressSessions()
  const navigate = useNavigate()
  const today = todayKey()
  const mins = minutesToday(state)
  const neglected = neglectedCategories(state)
  const weak = neglected[0] ?? 'communication'
  const kind = recommend(weak)
  const meta = SESSION_META[kind]
  const count = sessionsOn(state, today).length
  const mood = cerbMood(mins, state.goals)
  const cerb = CERB[mood]
  const goalPct = todayGoalProgressPct(mins, state.goals)
  const goalPctLabel = Math.round(goalPct)
  const goalBarPct = Math.min(100, goalPct)
  const activeForRecommend = inProgressForKind(state, kind)

  const options: HeroOption[] = [
    ...live.map((session) => ({ type: 'resume' as const, session })),
    ...(!activeForRecommend ? [{ type: 'next' as const }] : []),
  ]

  const [optionIndex, setOptionIndex] = useState(0)
  const [slideDir, setSlideDir] = useState<0 | 1 | -1>(0)
  const [panelKey, setPanelKey] = useState(0)
  const safeIndex = options.length === 0 ? 0 : Math.min(optionIndex, options.length - 1)
  const current = options[safeIndex]

  useEffect(() => {
    if (optionIndex > options.length - 1) {
      setOptionIndex(Math.max(0, options.length - 1))
    }
  }, [optionIndex, options.length])

  function start() {
    if (activeForRecommend) {
      navigate(activeSessionPath(activeForRecommend.id))
      return
    }
    const href = startHref(kind)
    if (href !== '/practice') {
      navigate(href)
      return
    }
    const session = buildSession(kind, state.customQuestions, {
      minutes: durationFor(state.durations, kind),
      removedQuestionIds: state.removedQuestionIds,
      promptCategoryIds: state.drillPromptCategoryIds,
    })
    dispatch({ type: 'start-session', session })
    navigate(activeSessionPath(session.id))
  }

  function selectOption(nextIndex: number) {
    if (options.length < 2 || nextIndex === safeIndex) return
    const wrapped =
      nextIndex > safeIndex
        ? nextIndex - safeIndex <= options.length / 2
          ? 1
          : -1
        : safeIndex - nextIndex <= options.length / 2
          ? -1
          : 1
    setSlideDir(wrapped)
    setPanelKey((k) => k + 1)
    setOptionIndex(nextIndex)
  }

  function go(delta: number) {
    if (options.length < 2) return
    selectOption((safeIndex + delta + options.length) % options.length)
  }

  return (
    <div className="stack stack-today">
      <div className="hero hero-today">
        <div className={`hero-action-slot${options.length > 1 ? ' has-pager' : ''}`}>
          {options.length > 1 ? (
            <button
              className="hero-action-chevron"
              type="button"
              aria-label="Previous option"
              onClick={() => go(-1)}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M10.5 3.5 5.5 8l5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}

          <div className="hero-action-main">
            <div
              key={panelKey}
              className={`hero-action-panel${
                slideDir === 1 ? ' slide-next' : slideDir === -1 ? ' slide-prev' : ''
              }`}
            >
              {current?.type === 'resume' ? (
                <ResumeSessionCard session={current.session} headingLevel="h1" />
              ) : current?.type === 'next' ? (
                <section className={`card action cat-${CATEGORY_BY_KIND[kind]}`}>
                  <p className="kicker">Next</p>
                  <h1>{meta.title}</h1>
                  <p className="lead">{meta.blurb}</p>
                  <div className="row">
                    <button className="btn" type="button" onClick={start}>
                      Start
                    </button>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {count === 1 ? '1 session today' : `${count} sessions today`}
                    </span>
                  </div>
                </section>
              ) : null}
            </div>

            {options.length > 1 ? (
              <div className="hero-action-dots" role="tablist" aria-label="Today options">
                {options.map((opt, i) => (
                  <button
                    key={opt.type === 'resume' ? opt.session.id : 'next'}
                    type="button"
                    role="tab"
                    aria-selected={i === safeIndex}
                    aria-label={
                      opt.type === 'resume'
                        ? `In progress: ${SESSION_META[opt.session.kind].title}`
                        : `Next: ${meta.title}`
                    }
                    className={`hero-action-dot${i === safeIndex ? ' is-active' : ''}`}
                    onClick={() => selectOption(i)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {options.length > 1 ? (
            <button
              className="hero-action-chevron"
              type="button"
              aria-label="Next option"
              onClick={() => go(1)}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                <path
                  d="M5.5 3.5 10.5 8l-5 4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
        </div>

        <aside className={`cerb cerb-${mood}`} aria-live="polite">
          <img className="cerb-art" src={cerb.src} alt={cerb.alt} width={300} height={261} />
          <div className="cerb-copy">
            <p className="cerb-status">{cerb.status}</p>
            <div className="cerb-progress">
              <div
                className={`cerb-progress-bar${goalPct >= 100 ? ' is-met' : ''}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(goalBarPct)}
                aria-label={`${goalPctLabel}% of today's goals`}
              >
                <span style={{ width: `${goalBarPct}%` }} />
              </div>
              <p className="cerb-progress-label">{goalPctLabel}% of today's goals</p>
            </div>
          </div>
        </aside>
      </div>

      <section className="card quiet today-card">
        <p className="kicker">Today</p>
        <h2>Time by category</h2>
        {CATEGORIES.map((c) => {
          const have = mins[c]
          const goal = state.goals[c]
          const met = have >= goal
          const pct = Math.min(100, (have / Math.max(1, goal)) * 100)
          return (
            <Link
              className={`goal-row goal-link cat-${c}${met ? ' is-met' : ''}`}
              key={c}
              to={hrefFor(c)}
              aria-label={
                met
                  ? `${CATEGORY_LABEL[c]}: goal met, ${Math.round(have)} of ${goal} minutes`
                  : `${CATEGORY_LABEL[c]}: ${Math.round(have)} of ${goal} minutes`
              }
            >
              <span className="goal-label">{CATEGORY_LABEL[c]}</span>
              <div className={`bar${met ? ' is-full' : ''}`}>
                <span style={{ width: `${pct}%` }} />
              </div>
              <span className="num">
                {met ? <span className="chip goal-met-chip">Goal met</span> : `${Math.round(have)}m / ${goal}m`}
              </span>
            </Link>
          )
        })}
      </section>

      <section className="card quiet">
        <p className="kicker">Streaks</p>
        <h2>Goal days by category</h2>
        <div className="streak-grid">
          {CATEGORIES.map((c) => (
            <StreakCalendar key={c} category={c} />
          ))}
        </div>
      </section>
    </div>
  )
}

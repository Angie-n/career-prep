import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { StreakCalendar } from '../components/StreakCalendar'
import { CERB, cerbMood, type CerbMood } from '../lib/cerb'
import { applicationsSubmittedAllTime, formatTotalMinutes, minutesAllTime, minutesToday, neglectedCategories, promptsAnsweredAllTime, sessionsOn, todayGoalProgressPct } from '../lib/insights'
import { todayKey } from '../lib/ids'
import { activeSessionPath, buildSession, isPhasePaused, startHref } from '../lib/sessionPlan'
import { deleteSessionMedia } from '../lib/storage'
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
  return 'comm-cold'
}

function hrefFor(category: Category) {
  if (category === 'applications') return '/applications'
  return '/practice'
}

function resumeRally(mood: CerbMood): string {
  if (mood === 'happy') return 'You crushed it. Go again.'
  if (mood === 'disappointed') return 'You started. Now finish.'
  return 'FINISH WHAT YOU STARTED'
}

type HeroOption = { type: 'resume'; session: PracticeSession } | { type: 'next' }

function useProgressClock(hasLiveSession: boolean, hasRunningSession: boolean, sessionKey: string) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    // Always refresh on mount / when live sessions appear (e.g. after hydrate),
    // even if every clock is paused.
    setNow(Date.now())
    if (!hasRunningSession) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [hasLiveSession, hasRunningSession, sessionKey])
  return now
}

function Chevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        d={dir === 'prev' ? 'M10.5 3.5 5.5 8l5 4.5' : 'M5.5 3.5 10.5 8l-5 4.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function StatIcon({ kind }: { kind: 'apps' | 'prompts' }) {
  if (kind === 'apps') {
    return (
      <svg className="today-stat-icon" viewBox="0 0 80 80" aria-hidden="true">
        <rect x="14" y="10" width="40" height="52" rx="6" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <path d="M28 10v-2a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v2" fill="none" stroke="currentColor" strokeWidth="3.5" />
        <path d="M24 28h20M24 38h16M24 48h12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="58" cy="54" r="14" fill="currentColor" opacity="0.18" />
        <path d="M58 47v14M51 54h14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    )
  }
  return (
    <svg className="today-stat-icon" viewBox="0 0 80 80" aria-hidden="true">
      <path
        d="M18 24c0-8 8-14 22-14s22 6 22 14v10c0 8-8 14-22 14h-4l-10 10v-12c-5-2-8-7-8-12V24z"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M30 28h20M30 38h14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  )
}

export function Dashboard() {
  const { state, dispatch } = useStore()
  const live = useInProgressSessions()
  const navigate = useNavigate()
  const today = todayKey()
  const liveKey = live.map((s) => `${s.id}:${s.phasePausedElapsedSec ?? s.phaseStartedAt ?? ''}`).join('|')
  const running = state.sessions.some((s) => s.inProgress && !isPhasePaused(s))
  const now = useProgressClock(live.length > 0, running, liveKey)
  const mins = minutesToday(state, today, now)
  const promptsAnswered = promptsAnsweredAllTime(state)
  const appsSubmitted = applicationsSubmittedAllTime(state)
  const lifetimeMins = minutesAllTime(state, now)
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

  const heroCategory =
    current?.type === 'resume'
      ? CATEGORY_BY_KIND[current.session.kind]
      : CATEGORY_BY_KIND[kind]

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

  function resume(session: PracticeSession) {
    navigate(activeSessionPath(session.id))
  }

  function discard(session: PracticeSession) {
    if (!window.confirm('Discard this in-progress session? Progress in this block will be lost.')) return
    void deleteSessionMedia(session)
    dispatch({ type: 'abandon-session', id: session.id })
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

  const isResume = current?.type === 'resume'
  const title = isResume ? SESSION_META[current.session.kind].title : meta.title
  const blurb = isResume ? 'Pick up where you left off.' : meta.blurb
  const kicker = isResume ? 'In progress' : 'Up next'
  const rally = isResume ? resumeRally(mood) : 'STEP TO IT'

  return (
    <div className="stack stack-today">
      <div className="page-head">
        <p className="kicker">Dashboard</p>
        <h1>Welcome back</h1>
      </div>

      <div className="today-layout">
        <div className="today-main">
          <section className={`today-arena cat-${heroCategory}`}>
            <p className="today-arena-rally">{rally}</p>

            <div className={`today-arena-stage${options.length > 1 ? ' has-pager' : ''}`}>
              {options.length > 1 ? (
                <button
                  className="today-arena-chevron"
                  type="button"
                  aria-label="Previous option"
                  onClick={() => go(-1)}
                >
                  <Chevron dir="prev" />
                </button>
              ) : null}

              <div
                key={panelKey}
                className={`today-arena-body${
                  slideDir === 1 ? ' slide-next' : slideDir === -1 ? ' slide-prev' : ''
                }`}
              >
                <div className="today-arena-copy">
                  <p className="today-arena-kicker">{kicker}</p>
                  <h1 className="today-arena-title">{title}</h1>
                  <p className="today-arena-blurb">{blurb}</p>
                  <div className="today-arena-actions">
                    {isResume ? (
                      <>
                        <button className="btn today-arena-btn" type="button" onClick={() => resume(current.session)}>
                          Resume
                        </button>
                        <button
                          className="btn ghost today-arena-ghost"
                          type="button"
                          onClick={() => discard(current.session)}
                        >
                          Discard
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn today-arena-btn" type="button" onClick={start}>
                          Start now
                        </button>
                        <span className="today-arena-meta">
                          {count === 1 ? '1 session today' : `${count} sessions today`}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <aside key={mood} className={`today-arena-cerb cerb-${mood}`} aria-live="polite">
                  <img className="today-arena-cerb-art" src={cerb.src} alt={cerb.alt} width={340} height={296} />
                  <p className="today-arena-cerb-status">{cerb.status}</p>
                </aside>
              </div>

              {options.length > 1 ? (
                <button
                  className="today-arena-chevron"
                  type="button"
                  aria-label="Next option"
                  onClick={() => go(1)}
                >
                  <Chevron dir="next" />
                </button>
              ) : null}
            </div>

            {options.length > 1 ? (
              <div className="today-arena-dots" role="tablist" aria-label="Today options">
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
                    className={`today-arena-dot${i === safeIndex ? ' is-active' : ''}`}
                    onClick={() => selectOption(i)}
                  />
                ))}
              </div>
            ) : null}

            <div className="today-arena-progress">
              <div
                className={`today-arena-progress-bar${goalPct >= 100 ? ' is-met' : ''}`}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(goalBarPct)}
                aria-label={`${goalPctLabel}% of today's goals`}
              >
                <span style={{ width: `${goalBarPct}%` }} />
              </div>
              <p className="today-arena-progress-label">{goalPctLabel}% of today's goals</p>
            </div>
          </section>

          <section className="today-board">
            <div className="today-board-head">
              <h2>Today's Progress</h2>
            </div>
            <div className="today-meters">
              {CATEGORIES.map((c) => {
                const have = mins[c]
                const goal = state.goals[c]
                const met = have >= goal
                const pct = Math.min(100, (have / Math.max(1, goal)) * 100)
                return (
                  <Link
                    className={`today-meter cat-${c}${met ? ' is-met' : ''}`}
                    key={c}
                    to={hrefFor(c)}
                    aria-label={
                      met
                        ? `${CATEGORY_LABEL[c]}: goal met, ${Math.round(have)} of ${goal} minutes`
                        : `${CATEGORY_LABEL[c]}: ${Math.round(have)} of ${goal} minutes`
                    }
                  >
                    <span className="today-meter-label">{CATEGORY_LABEL[c]}</span>
                    <div className={`bar${met ? ' is-full' : ''}`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <span className="today-meter-num">
                      {met ? <span className="chip goal-met-chip">Goal met</span> : `${Math.round(have)}m / ${goal}m`}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>

          <section className="today-board today-achievements">
            <div className="today-board-head">
              <h2>Total Progress</h2>
            </div>
            <div className="today-stats">
              {CATEGORIES.map((c) => {
                const count = c === 'applications' ? appsSubmitted : promptsAnswered
                const countLabel = c === 'applications' ? 'Applications submitted' : 'Prompts answered'
                const time = formatTotalMinutes(lifetimeMins[c])
                const icon = c === 'applications' ? 'apps' : 'prompts'
                return (
                  <Link
                    key={c}
                    className={`today-stat cat-${c}`}
                    to={hrefFor(c)}
                    aria-label={`${CATEGORY_LABEL[c]}: ${count} ${countLabel.toLowerCase()}, ${time} total`}
                  >
                    <StatIcon kind={icon} />
                    <h3 className="today-stat-category">{CATEGORY_LABEL[c]}</h3>
                    <div className="today-stat-metrics">
                      <div className="today-stat-metric">
                        <span className="today-stat-num">{count}</span>
                        <span className="today-stat-label">{countLabel}</span>
                      </div>
                      <div className="today-stat-metric">
                        <span className="today-stat-num is-time">{time}</span>
                        <span className="today-stat-label">Time dedicated</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        </div>

        <aside className="today-board today-streaks">
          <div className="today-board-head">
            <h2>Streaks</h2>
          </div>
          <div className="streak-grid today-streak-grid">
            {CATEGORIES.map((c) => (
              <StreakCalendar key={c} category={c} />
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

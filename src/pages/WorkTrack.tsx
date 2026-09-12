import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryGlance } from '../components/CategoryGlance'
import { CategorySubnav } from '../components/CategorySubnav'
import { MinutesPicker } from '../components/MinutesPicker'
import { activeSessionPath, buildSession } from '../lib/sessionPlan'
import { deleteSessionMedia } from '../lib/storage'
import { CATEGORY_LABEL, SESSION_META, clampMinutes } from '../lib/types'
import { useInProgressForCategory, useStore } from '../state/Store'

const category = 'applications' as const
const kind = 'apps-block' as const

export function WorkTrack() {
  const { state, dispatch } = useStore()
  const matchingActive = useInProgressForCategory(category)
  const navigate = useNavigate()
  const goalMinutes = state.goals[category]
  const [minutes, setMinutesLocal] = useState(goalMinutes)
  const [note, setNote] = useState('')
  const [starting, setStarting] = useState(false)
  const meta = SESSION_META[kind]

  useEffect(() => {
    setMinutesLocal(goalMinutes)
  }, [goalMinutes])

  function setMinutes(next: number) {
    const value = clampMinutes(next, goalMinutes)
    setMinutesLocal(value)
    dispatch({
      type: 'set-durations',
      durations: { ...state.durations, [kind]: value },
    })
  }

  async function start() {
    if (matchingActive) {
      navigate(activeSessionPath(matchingActive.id))
      return
    }
    setStarting(true)
    try {
      const session = buildSession(kind, state.customQuestions, {
        minutes,
        note,
        removedQuestionIds: state.removedQuestionIds,
      })
      dispatch({ type: 'start-session', session })
      navigate(activeSessionPath(session.id))
    } finally {
      setStarting(false)
    }
  }

  function discard() {
    if (!matchingActive) return
    if (!window.confirm('Discard this in-progress session? Progress in this block will be lost.')) return
    void deleteSessionMedia(matchingActive)
    dispatch({ type: 'abandon-session', id: matchingActive.id })
  }

  return (
    <div className="stack">
      <div className="page-head">
        <p className="kicker">{CATEGORY_LABEL[category]}</p>
        <h1>{meta.title}</h1>
        <p className="lead">{meta.blurb}</p>
      </div>

      <CategorySubnav category={category} />

      <CategoryGlance category={category} />
      <section className="card action start-card">
        <div className="start-card-copy">
          <h2>{meta.title}</h2>
          <p className="muted">
            {matchingActive
              ? 'Pick up where you left off.'
              : `This time counts only toward ${CATEGORY_LABEL[category].toLowerCase()}.`}
          </p>
        </div>
        {!matchingActive ? (
          <label className="field start-card-note">
            What are you working on? (optional)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Company + role…"
            />
          </label>
        ) : null}
        {!matchingActive ? (
          <p className="muted start-card-hint">
            After you start, open one or more applications — paste JDs, set status, and add notes
            and links.
          </p>
        ) : null}
        <div className="start-card-actions">
          {!matchingActive ? <MinutesPicker value={minutes} onChange={setMinutes} /> : null}
          {matchingActive ? (
            <>
              <button className="btn" type="button" onClick={() => void start()}>
                Resume
              </button>
              <button className="btn ghost" type="button" onClick={discard}>
                Discard
              </button>
            </>
          ) : (
            <button className="btn" type="button" onClick={() => void start()} disabled={starting}>
              {starting ? 'Loading…' : 'Start now'}
            </button>
          )}
        </div>
      </section>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryGlance } from '../components/CategoryGlance'
import { CategorySubnav } from '../components/CategorySubnav'
import { MinutesPicker } from '../components/MinutesPicker'
import { ResumeSessionCard } from '../components/ResumeSessionCard'
import { activeSessionPath, buildSession, previousDrafts } from '../lib/sessionPlan'
import {
  SESSION_META,
  clampMinutes,
  durationFor,
  type DurationKind,
  type SessionAnswer,
  type SessionKind,
} from '../lib/types'
import { useInProgressForCategory, useStore } from '../state/Store'

export function Practice() {
  const { state, dispatch } = useStore()
  const session = useInProgressForCategory('communication')
  const navigate = useNavigate()
  const [pickedDraft, setPickedDraft] = useState<SessionAnswer | ''>('')
  const drafts = previousDrafts(state.sessions)
  const busy = Boolean(session)

  function start(kind: SessionKind) {
    if (session) {
      navigate(activeSessionPath(session.id))
      return
    }
    const draft = kind === 'comm-deliver' ? pickedDraft || drafts[0] : undefined
    const built = buildSession(kind, state.customQuestions, {
      draft,
      minutes: durationFor(state.durations, kind),
    })
    dispatch({ type: 'start-session', session: built })
    navigate(activeSessionPath(built.id))
  }

  function activityCard(k: SessionKind, extraClass = '') {
    return (
      <section className={`card action start-card ${extraClass}`.trim()} key={k}>
        <div className="start-card-copy">
          <h2>{SESSION_META[k].title}</h2>
          <p className="muted">{SESSION_META[k].blurb}</p>
        </div>
        <div className="start-card-actions">
          <MinutesPicker
            value={durationFor(state.durations, k)}
            onChange={(minutes) =>
              dispatch({
                type: 'set-durations',
                durations: {
                  ...state.durations,
                  [k]: clampMinutes(minutes, state.durations[k as DurationKind]),
                },
              })
            }
          />
          <button
            className="btn"
            type="button"
            onClick={() => start(k)}
            disabled={busy || (k === 'comm-deliver' && drafts.length === 0)}
          >
            {busy ? 'Resume first' : 'Start'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="stack">
      <div>
        <p className="kicker">Communication</p>
        <h1>Practice speaking</h1>
        <p className="lead">Draft. Talk from that draft. Or rapid fire.</p>
      </div>
      <CategorySubnav category="communication" />
      <CategoryGlance category="communication" />
      {session ? <ResumeSessionCard session={session} headingLevel="h2" /> : null}
      {drafts.length > 0 ? (
        <label className="field" style={{ maxWidth: 520 }}>
          Draft to speak from
          <select
            value={pickedDraft ? `${pickedDraft.questionId}|${pickedDraft.storyId ?? ''}` : ''}
            onChange={(e) => {
              const next = drafts.find((d) => `${d.questionId}|${d.storyId ?? ''}` === e.target.value)
              setPickedDraft(next ?? '')
            }}
            disabled={busy}
          >
            <option value="">Use the latest draft</option>
            {drafts.slice(0, 20).map((d) => (
              <option key={d.questionId + (d.storyId ?? '')} value={`${d.questionId}|${d.storyId ?? ''}`}>
                {d.prompt.slice(0, 80)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="muted">Talk-from-draft needs a saved draft first. Draft and Rapid Fire can start now.</p>
      )}
      <div className="practice-paths">
        <div className="practice-flow" aria-label="Draft, then talk from that draft">
          <div className="practice-flow-nodes">
            {activityCard('comm-draft')}
            <div className="practice-flow-edge" aria-hidden="true">
              <span className="practice-flow-line" />
              <span className="practice-flow-arrow" />
            </div>
            {activityCard('comm-deliver')}
          </div>
        </div>
        {activityCard('comm-cold', 'practice-cold')}
      </div>
    </div>
  )
}

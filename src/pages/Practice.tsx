import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryGlance } from '../components/CategoryGlance'
import { CategorySubnav } from '../components/CategorySubnav'
import { MinutesPicker } from '../components/MinutesPicker'
import { QuestionRecap } from '../components/QuestionRecap'
import { Recorder } from '../components/Recorder'
import { Timer } from '../components/Timer'
import { buildSession, homeForKind, previousDrafts } from '../lib/sessionPlan'
import {
  SESSION_META,
  clampMinutes,
  durationFor,
  emptyReflection,
  type DurationKind,
  type Reflection,
  type SessionAnswer,
  type SessionKind,
} from '../lib/types'
import { useActiveSession, useStore } from '../state/Store'

export function Practice() {
  const { state, dispatch } = useStore()
  const session = useActiveSession()
  const navigate = useNavigate()
  const [paused, setPaused] = useState(false)
  const [timesUp, setTimesUp] = useState(false)
  const [reflecting, setReflecting] = useState(false)
  const [reflection, setReflection] = useState<Reflection>(emptyReflection())
  const [pickedDraft, setPickedDraft] = useState<SessionAnswer | ''>('')
  const drafts = previousDrafts(state.sessions)

  const phase = session?.phases[session.currentPhaseIndex]
  const answer = session?.answers.find(
    (a) => a.questionId === phase?.questionId && a.storyId === phase.storyId,
  )

  const phaseLabel = useMemo(() => {
    if (!phase) return ''
    if (phase.kind === 'draft') return 'Draft — write the answer'
    if (phase.kind === 'deliver') return 'Deliver — draft is hidden'
    if (phase.kind === 'think') return 'Think — no notes'
    if (phase.kind === 'block') return 'Block — stay on this'
    return 'Speak — clock is running'
  }, [phase])

  const patch = useCallback(
    (partial: Partial<typeof session>) => {
      if (!session) return
      dispatch({ type: 'patch-session', session: { ...session, ...partial } })
    },
    [dispatch, session],
  )

  const updateAnswer = useCallback(
    (
      match: { questionId: string; storyId?: string },
      next: { draftNotes?: string; transcript?: string; audioId?: string },
    ) => {
      if (!session) return
      dispatch({
        type: 'patch-session',
        session: {
          ...session,
          answers: session.answers.map((a) =>
            a.questionId === match.questionId && a.storyId === match.storyId ? { ...a, ...next } : a,
          ),
        },
      })
    },
    [dispatch, session],
  )

  const advance = useCallback(() => {
    if (!session) return
    const next = session.currentPhaseIndex + 1
    setTimesUp(false)
    if (next >= session.phases.length) {
      setReflecting(true)
      return
    }
    setPaused(false)
    patch({ currentPhaseIndex: next })
  }, [patch, session])

  function start(kind: SessionKind) {
    const draft = kind === 'comm-deliver' ? pickedDraft || drafts[0] : undefined
    const built = buildSession(kind, state.customQuestions, {
      draft,
      minutes: durationFor(state.durations, kind),
    })
    dispatch({ type: 'start-session', session: built })
    setReflecting(false)
    setReflection(emptyReflection())
    setPaused(false)
    setTimesUp(false)
  }

  function finish(skip = false) {
    if (!session) return
    dispatch({
      type: 'complete-session',
      id: session.id,
      reflection: skip || !reflection.note.trim() ? undefined : reflection,
    })
    navigate(homeForKind(session.kind))
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
            disabled={k === 'comm-deliver' && drafts.length === 0}
          >
            Start
          </button>
        </div>
      </section>
    )
  }

  if (!session || reflecting) {
    if (reflecting && session) {
      return (
        <div className="studio-frame recap-page">
          <div className="studio-top">
            <p className="kicker">Note, then look back</p>
            <button className="btn ghost" type="button" onClick={() => finish(true)}>
              Skip
            </button>
          </div>
          <div className="studio-body">
            <div className="prompt reflect stack">
              <h1>What just happened?</h1>
              <p className="muted">Capture the signal. Leave the rest.</p>
              <label className="field">
                Note
                <textarea
                  className="notes"
                  placeholder="Stuck, ramble, what landed, what to retry — whatever is useful."
                  value={reflection.note}
                  onChange={(e) => setReflection({ note: e.target.value })}
                />
              </label>
              <h2>This session</h2>
              {session.answers.map((a, i) => (
                <QuestionRecap
                  key={a.questionId + (a.storyId ?? '')}
                  answer={a}
                  index={i}
                  onChange={(next) => updateAnswer({ questionId: a.questionId, storyId: a.storyId }, next)}
                />
              ))}
              <button className="btn" type="button" onClick={() => finish(false)}>
                Save and done
              </button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="stack">
        <div>
          <p className="kicker">Communication</p>
          <h1>Practice speaking</h1>
          <p className="lead">Draft. Talk from that draft. Or go cold. Minutes here stay in Communication.</p>
        </div>
        <CategorySubnav category="communication" />
        <CategoryGlance category="communication" />
        {drafts.length > 0 ? (
          <label className="field" style={{ maxWidth: 520 }}>
            Draft to speak from
            <select
              value={pickedDraft ? `${pickedDraft.questionId}|${pickedDraft.storyId ?? ''}` : ''}
              onChange={(e) => {
                const next = drafts.find((d) => `${d.questionId}|${d.storyId ?? ''}` === e.target.value)
                setPickedDraft(next ?? '')
              }}
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
          <p className="muted">Talk-from-draft needs a saved draft first. Draft and cold can start now.</p>
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

  if (!phase) return null

  const speaking = phase.kind === 'deliver' || phase.kind === 'speak'
  const drafting = phase.kind === 'draft'
  const thinking = phase.kind === 'think'
  const blocking = phase.kind === 'block'

  const lastPhase = session.currentPhaseIndex >= session.phases.length - 1

  return (
    <div className="studio-frame">
      <header className="studio-top">
        <div>
          <p className="kicker">
            {SESSION_META[session.kind].title} · {session.currentPhaseIndex + 1}/{session.phases.length}
          </p>
          <strong>{timesUp ? 'Time’s up — continue when you’re ready' : phaseLabel}</strong>
        </div>
        <Timer key={phase.id} seconds={phase.durationSec} running={!paused && !timesUp} onExpire={setTimesUp} />
      </header>
      <div className="studio-body">
        <article className="prompt">
          <p className="muted" style={{ marginBottom: 10 }}>
            {thinking
              ? 'Organize in your head. Do not write.'
              : drafting
                ? 'Write the answer you would actually say. Tight, not a novel.'
                : blocking
                  ? 'Stay on this block. Tracker is on Applications / DSA when you need it.'
                  : 'The draft is hidden. Speak.'}
          </p>
          <h1>{phase.prompt}</h1>
          {drafting ? (
            <textarea
              className="notes"
              placeholder="Situation, the hard part, the choice, what happened — in language you can speak."
              value={answer?.draftNotes ?? ''}
              onChange={(e) =>
                updateAnswer(
                  { questionId: phase.questionId, storyId: phase.storyId },
                  { draftNotes: e.target.value },
                )
              }
              style={{ marginTop: 20 }}
            />
          ) : null}
          {speaking ? (
            <Recorder
              audioId={answer?.audioId}
              transcript={answer?.transcript ?? ''}
              onChange={(next) =>
                updateAnswer({ questionId: phase.questionId, storyId: phase.storyId }, next)
              }
            />
          ) : null}
        </article>
      </div>
      <footer className="studio-bot">
        <div className="row">
          <button className="btn ghost" type="button" onClick={() => setPaused((v) => !v)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button
            className={timesUp ? 'btn' : 'btn ghost'}
            type="button"
            onClick={advance}
          >
            {timesUp ? (lastPhase ? 'Wrap up' : 'Continue') : 'Next'}
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => setReflecting(true)}
          >
            End early
          </button>
        </div>
        <span />
      </footer>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QuestionRecap } from './QuestionRecap'
import { Recorder } from './Recorder'
import { Timer } from './Timer'
import { DsaStatsBar } from './DsaStatsBar'
import { dsaDifficultyBucket } from '../lib/dsaStats'
import { formatClock } from '../lib/ids'
import { homeForKind, isPhasePaused, phaseElapsedSec } from '../lib/sessionPlan'
import {
  SESSION_META,
  emptyReflection,
  type PracticeSession,
  type Reflection,
} from '../lib/types'
import { useStore } from '../state/Store'

export function SessionStudio({ session }: { session: PracticeSession }) {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [paused, setPaused] = useState(() => isPhasePaused(session))
  const [timesUp, setTimesUp] = useState(false)
  const [reflecting, setReflecting] = useState(false)
  const [reflection, setReflection] = useState<Reflection>(emptyReflection())

  const isDsaSession = session.kind === 'dsa-block'
  const dsaEntries = isDsaSession ? session.dsaRetrieved ?? [] : []

  const phase = session.phases[session.currentPhaseIndex]
  const answer = session.answers.find(
    (a) => a.questionId === phase?.questionId && a.storyId === phase.storyId,
  )
  const timerElapsed = phaseElapsedSec(session)
  const timerStartedAt =
    !paused && session.phaseStartedAt ? Date.parse(session.phaseStartedAt) : undefined
  const timerTarget = phase?.durationSec ?? 0

  useEffect(() => {
    if (!phase) {
      setPaused(false)
      setTimesUp(false)
      return
    }
    setPaused(isPhasePaused(session))
    setTimesUp(phaseElapsedSec(session) >= phase.durationSec)
    // Sync local timer UI when the active session phase changes in the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional field-level deps
  }, [
    session.id,
    session.currentPhaseIndex,
    session.phaseStartedAt,
    session.phasePausedElapsedSec,
    phase?.durationSec,
  ])

  const phaseLabel = useMemo(() => {
    if (!phase) return ''
    if (phase.kind === 'draft') return 'Draft — write the answer'
    if (phase.kind === 'deliver') return 'Deliver — draft is hidden'
    if (phase.kind === 'think') return 'Think — no notes'
    if (phase.kind === 'block') return ''
    return 'Speak — clock is running'
  }, [phase])

  const patch = useCallback(
    (partial: Partial<PracticeSession>) => {
      dispatch({ type: 'patch-session', session: { ...session, ...partial } })
    },
    [dispatch, session],
  )

  const updateAnswer = useCallback(
    (
      match: { questionId: string; storyId?: string },
      next: { draftNotes?: string; transcript?: string; audioId?: string },
    ) => {
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
    const next = session.currentPhaseIndex + 1
    if (next >= session.phases.length) {
      patch({ phasePausedElapsedSec: phaseElapsedSec(session) })
      setPaused(true)
      setReflecting(true)
      return
    }
    setTimesUp(false)
    setPaused(false)
    patch({
      currentPhaseIndex: next,
      phaseStartedAt: new Date().toISOString(),
      phasePausedElapsedSec: undefined,
    })
  }, [patch, session])

  const backFromReflect = useCallback(() => {
    setReflecting(false)
  }, [])

  const togglePause = useCallback(() => {
    if (!phase) return
    if (paused || isPhasePaused(session)) {
      const elapsed = session.phasePausedElapsedSec ?? phaseElapsedSec(session)
      const started = new Date(Date.now() - elapsed * 1000).toISOString()
      patch({ phaseStartedAt: started, phasePausedElapsedSec: undefined })
      setPaused(false)
      return
    }
    patch({ phasePausedElapsedSec: phaseElapsedSec(session) })
    setPaused(true)
  }, [paused, patch, phase, session])

  const adjustTarget = useCallback(
    (deltaSec: number) => {
      if (!phase) return
      const nextDuration = Math.max(60, phase.durationSec + deltaSec)
      const phases = session.phases.map((p, i) =>
        i === session.currentPhaseIndex ? { ...p, durationSec: nextDuration } : p,
      )
      patch({ phases })
      setTimesUp(phaseElapsedSec(session) >= nextDuration)
    },
    [patch, phase, session],
  )

  function finish(skip = false) {
    const shouldSaveReflection = !(skip || !reflection.note.trim())
    dispatch({
      type: 'complete-session',
      id: session.id,
      reflection: shouldSaveReflection ? reflection : undefined,
    })
    navigate(homeForKind(session.kind))
  }

  if (reflecting) {
    if (session.kind === 'dsa-block') {
      const dsaAnswer = session.answers.find((a) => a.questionId === 'dsa-block')
      const notes = dsaAnswer?.draftNotes ?? ''

      return (
        <div className="studio-frame recap-page dsa-session-frame">
          <header className="studio-top">
            <div>
              <h1 className="studio-session-title">{SESSION_META[session.kind].title}</h1>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                Retrieved + your notes
              </p>
            </div>
            <div className="studio-controls">
              <button className="btn ghost" type="button" onClick={backFromReflect}>
                Back
              </button>
              <button className="btn" type="button" onClick={() => finish(false)}>
                Conclude Session
              </button>
            </div>
          </header>
          <div className="studio-body">
            <div className="prompt reflect stack">
              <p className="muted">
                Tracker snapshot from this block, plus local notes and takeaways (not written back to
                Sheets).
              </p>

              <DsaStatsBar entries={session.dsaRetrieved ?? []} />

              <h2>Retrieved from tracker</h2>
              {session.dsaRetrieved?.length ? (
                <div className="cues">
                  {session.dsaRetrieved.map((r, i) => {
                    const bucket = dsaDifficultyBucket(r.difficulty)
                    return (
                      <section className="cue dsa-log-cue" key={r.id ?? `${r.problem}-${i}`}>
                        <div className="row" style={{ justifyContent: 'space-between' }}>
                          <b>Problem {i + 1}</b>
                          {r.difficulty ? (
                            <span
                              className={`dsa-diff-chip${bucket ? ` dsa-diff-${bucket}` : ''}`}
                            >
                              {r.difficulty}
                            </span>
                          ) : null}
                        </div>
                        <p className="dsa-log-problem">{r.problem}</p>
                        {r.topics ? (
                          <p className="muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                            {r.topics}
                          </p>
                        ) : null}
                        {r.notes ? (
                          <p className="faint" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                            {r.notes}
                          </p>
                        ) : null}
                      </section>
                    )
                  })}
                </div>
              ) : (
                <p className="muted">No tracker rows were retrieved for this session.</p>
              )}

              <label className="field">
                Session notes
                <textarea
                  className="notes"
                  placeholder="Local notes for this block — not written back to your sheet."
                  value={notes}
                  onChange={(e) =>
                    updateAnswer({ questionId: 'dsa-block' }, { draftNotes: e.target.value })
                  }
                />
              </label>

              <label className="field">
                Key Takeaways
                <textarea
                  className="notes"
                  placeholder="What stuck, what to retry, patterns to remember…"
                  value={reflection.note}
                  onChange={(e) => setReflection({ note: e.target.value })}
                />
              </label>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="studio-frame recap-page">
        <header className="studio-top">
          <div>
            <p className="kicker">Note, then look back</p>
            <strong>What just happened?</strong>
          </div>
          <div className="studio-controls">
            <button className="btn ghost" type="button" onClick={backFromReflect}>
              Back
            </button>
            <button className="btn" type="button" onClick={() => finish(false)}>
              Conclude Session
            </button>
          </div>
        </header>
        <div className="studio-body">
          <div className="prompt reflect stack">
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
                onChange={(next) =>
                  updateAnswer({ questionId: a.questionId, storyId: a.storyId }, next)
                }
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!phase) return null

  const speaking = phase.kind === 'deliver' || phase.kind === 'speak'
  const drafting = phase.kind === 'draft'
  const thinking = phase.kind === 'think'
  const blocking = phase.kind === 'block'

  const isDsaBlock = session.kind === 'dsa-block' && blocking
  const dsaTrackers = state.sheets.dsa.filter((s) => s.url.trim())
  const usedTracker = isDsaBlock
    ? state.sheets.dsa.find((s) => s.id === phase.questionId && s.url.trim())
    : undefined

  return (
    <div className={`studio-frame${isDsaBlock ? ' dsa-session-frame' : ''}`}>
      <header className="studio-top">
        <div>
          {isDsaBlock ? (
            <>
              <h1 className="studio-session-title">{SESSION_META[session.kind].title}</h1>
              {timesUp ? (
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  Time’s up — continue when you’re ready
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className="kicker">
                {SESSION_META[session.kind].title} · {session.currentPhaseIndex + 1}/
                {session.phases.length}
              </p>
              {timesUp ? (
                <strong>Time’s up — continue when you’re ready</strong>
              ) : phaseLabel ? (
                <strong>{phaseLabel}</strong>
              ) : null}
            </>
          )}
        </div>
        <div className="studio-controls">
          <button className="btn ghost" type="button" onClick={togglePause}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button className={timesUp ? 'btn' : 'btn ghost'} type="button" onClick={advance}>
            Next
          </button>
        </div>
      </header>
      <div className={`studio-body${isDsaBlock ? ' dsa-session-body' : ''}`}>
        <article className={`prompt${isDsaBlock ? ' dsa-session-prompt' : ''}`}>
          <Timer
            key={`${phase.id}-${session.phaseStartedAt ?? ''}-${session.phasePausedElapsedSec ?? 'run'}`}
            elapsedSec={timerElapsed}
            startedAt={timerStartedAt}
            targetSec={timerTarget}
            running={!paused}
            onExpire={setTimesUp}
            onAdjustTarget={adjustTarget}
            variant="hero"
          />
          {!blocking && (
            <p className="muted" style={{ marginBottom: 10, textAlign: 'center' }}>
              {thinking
                ? 'Organize in your head. Do not write.'
                : drafting
                  ? 'Write the answer you would actually say. Tight, not a novel.'
                  : phase.kind === 'speak'
                    ? 'Speak. No notes.'
                    : 'The draft is hidden. Speak.'}
            </p>
          )}
          {!isDsaBlock ? <h1 style={{ textAlign: 'center' }}>{phase.prompt}</h1> : null}
          {isDsaBlock ? (
            <div className="dsa-session">
              <div className="dsa-session-trackers">
                <p className="kicker">Tracker logs</p>
                {usedTracker ? (
                  <div className="row" style={{ alignItems: 'baseline' }}>
                    <span className="muted">Used tracker:</span>
                    <Link
                      className="btn ghost dsa-tracker-link"
                      to={`/dsa/tracker?sourceId=${encodeURIComponent(usedTracker.id)}`}
                    >
                      {usedTracker.name}
                    </Link>
                  </div>
                ) : dsaTrackers.length ? (
                  <div className="row">
                    {dsaTrackers.map((s) => (
                      <Link
                        key={s.id}
                        className="btn ghost dsa-tracker-link"
                        to={`/dsa/tracker?sourceId=${encodeURIComponent(s.id)}`}
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="muted">Add a DSA tracker link first on the tracker page.</p>
                )}
              </div>

              <DsaStatsBar entries={dsaEntries} label="Live session stats" />

              <div className="dsa-session-columns">
                <div className="dsa-session-col dsa-session-log">
                  <h2 className="dsa-col-heading">From your tracker</h2>
                  <p className="muted dsa-log-hint">
                    Read-only snapshot from Google Sheets. Edit the sheet in Google — use the tracker
                    links above.
                  </p>
                  {dsaEntries.length ? (
                    <div className="dsa-log-list">
                      {dsaEntries.map((r, i) => {
                        const bucket = dsaDifficultyBucket(r.difficulty)
                        return (
                          <section className="cue dsa-log-cue" key={r.id ?? `${r.problem}-${i}`}>
                            <div className="row" style={{ justifyContent: 'space-between' }}>
                              <b>Problem {i + 1}</b>
                              {r.difficulty ? (
                                <span
                                  className={`dsa-diff-chip${bucket ? ` dsa-diff-${bucket}` : ''}`}
                                >
                                  {r.difficulty}
                                </span>
                              ) : null}
                            </div>
                            <p className="dsa-log-problem">{r.problem}</p>
                            {r.topics ? (
                              <p className="muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                                {r.topics}
                              </p>
                            ) : null}
                            {r.notes ? (
                              <p className="faint" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                                {r.notes}
                              </p>
                            ) : null}
                            {typeof r.timeSec === 'number' ? (
                              <p className="muted" style={{ marginTop: 8 }}>
                                Time: {formatClock(r.timeSec)}
                              </p>
                            ) : null}
                          </section>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="muted">
                      No tracker rows retrieved for this block. Update your sheet in Google, then
                      start a new session — or open a tracker link above.
                    </p>
                  )}
                </div>

                <div className="dsa-session-col dsa-session-notes-col">
                  <label className="field dsa-notes-field">
                    <span className="dsa-col-heading">Session notes</span>
                    <textarea
                      className="notes dsa-session-notes-area"
                      placeholder="Local notes for this block — not written back to your sheet."
                      value={answer?.draftNotes ?? ''}
                      onChange={(e) =>
                        updateAnswer(
                          { questionId: phase.questionId, storyId: phase.storyId },
                          { draftNotes: e.target.value },
                        )
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : null}
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
    </div>
  )
}

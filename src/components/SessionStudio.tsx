import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppsSessionPanel } from './AppsSessionPanel'
import { QuestionRecap } from './QuestionRecap'
import { Recorder } from './Recorder'
import { Timer } from './Timer'
import { DsaStatsBar } from './DsaStatsBar'
import { DsaSessionPanel } from './DsaSessionPanel'
import { dsaDifficultyBucket } from '../lib/dsaStats'
import { googleAccessToken, subscribeGoogle } from '../lib/googleAuth'
import {
  DSA_TRACKER_POLL_MS,
  dsaRetrievedChanged,
  mergeDsaRetrieved,
  retrieveDsaFromTrackers,
} from '../lib/retrieveDsa'
import { homeForKind, isPhasePaused, phaseElapsedSec } from '../lib/sessionPlan'
import { deleteSessionMedia } from '../lib/storage'
import {
  SESSION_META,
  emptyReflection,
  reflectionHasContent,
  type MediaKind,
  type PracticeSession,
  type Reflection,
} from '../lib/types'
import { useStore } from '../state/Store'

function dsaTrackerQuery(session: PracticeSession): string {
  const prompt = session.phases[0]?.prompt?.trim() ?? ''
  // Default session titles are not tracker filters (legacy + current).
  if (!prompt || prompt === 'DSA block' || prompt === SESSION_META['dsa-block'].title) return ''
  return prompt
}

export function SessionStudio({ session }: { session: PracticeSession }) {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [paused, setPaused] = useState(() => isPhasePaused(session))
  const [timesUp, setTimesUp] = useState(false)
  const [reflecting, setReflecting] = useState(false)
  const [reflection, setReflection] = useState<Reflection>(emptyReflection())
  const [recordHint, setRecordHint] = useState('')
  const sessionRef = useRef(session)
  sessionRef.current = session

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

  // Resuming an active session should start the clock immediately (leave-studio freezes it).
  useEffect(() => {
    if (!isPhasePaused(session)) return
    const elapsed = session.phasePausedElapsedSec ?? 0
    const started = new Date(Date.now() - elapsed * 1000).toISOString()
    dispatch({
      type: 'patch-session',
      session: {
        ...session,
        phaseStartedAt: started,
        phasePausedElapsedSec: undefined,
      },
    })
    // Only when entering / switching into this studio — not on intentional in-studio Pause.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- session.id gate
  }, [session.id, dispatch])

  // Keep "From your tracker" in sync with Google Sheets while the block runs.
  useEffect(() => {
    if (!isDsaSession || !session.inProgress || reflecting) return

    let cancelled = false
    let inFlight = false

    const refresh = async () => {
      if (cancelled || inFlight) return
      inFlight = true
      try {
        const current = sessionRef.current
        const next = await retrieveDsaFromTrackers(state.sheets.dsa, dsaTrackerQuery(current))
        if (cancelled) return
        const prev = current.dsaRetrieved ?? []
        const merged = mergeDsaRetrieved(prev, next)
        if (!dsaRetrievedChanged(prev, merged)) return
        dispatch({
          type: 'patch-session',
          session: { ...sessionRef.current, dsaRetrieved: merged },
        })
      } catch {
        // Keep the last good snapshot if a poll fails.
      } finally {
        inFlight = false
      }
    }

    void refresh()
    const intervalId = window.setInterval(() => void refresh(), DSA_TRACKER_POLL_MS)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    const unsubGoogle = subscribeGoogle(() => {
      if (googleAccessToken()) void refresh()
    })

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisibility)
      unsubGoogle()
    }
  }, [isDsaSession, session.id, session.inProgress, reflecting, state.sheets.dsa, dispatch])

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

  const phaseTitle = useMemo(() => {
    if (!phase) return SESSION_META[session.kind].title
    if (session.kind === 'comm-draft') {
      if (phase.kind === 'draft') return 'Draft the answer'
      if (phase.kind === 'deliver') return 'Talk from the draft'
    }
    return SESSION_META[session.kind].title
  }, [phase, session.kind])

  const patch = useCallback(
    (partial: Partial<PracticeSession>) => {
      dispatch({ type: 'patch-session', session: { ...session, ...partial } })
    },
    [dispatch, session],
  )

  const updateAnswer = useCallback(
    (
      match: { questionId: string; storyId?: string },
      next: {
        draftNotes?: string
        transcript?: string
        audioId?: string
        mediaKind?: MediaKind
      },
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
    setRecordHint('')
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
  }, [patch, phase, session])

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
    const shouldSaveReflection = !(skip || !reflectionHasContent(reflection))
    const saved: Reflection | undefined = shouldSaveReflection
      ? {
        ...emptyReflection(),
        ...reflection,
      }
      : undefined
    void deleteSessionMedia(session).catch(() => {})
    dispatch({
      type: 'complete-session',
      id: session.id,
      reflection: saved,
    })
    navigate(homeForKind(session.kind))
  }

  const workLocked = timesUp

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
                  value={reflection.additionalNotes}
                  onChange={(e) =>
                    setReflection((prev) => ({ ...prev, additionalNotes: e.target.value }))
                  }
                />
              </label>
            </div>
          </div>
        </div>
      )
    }

    if (session.kind === 'apps-block') {
      return (
        <div className="studio-frame recap-page apps-session-frame">
          <header className="studio-top">
            <div>
              <h1 className="studio-session-title">{SESSION_META[session.kind].title}</h1>
              <p className="muted" style={{ margin: '4px 0 0' }}>
                Reflect on this block
              </p>
            </div>
            <div className="studio-controls">
              <button className="btn ghost" type="button" onClick={backFromReflect}>
                Back
              </button>
              <button className="btn" type="button" onClick={() => finish(false)}>
                End Reflection
              </button>
            </div>
          </header>
          <div className="studio-body">
            <div className="prompt reflect stack">
              <label className="field">
                What did you get done?
                <textarea
                  className="notes"
                  placeholder="Roles opened, postings marked up, notes written, applications submitted…"
                  value={reflection.gotDone ?? ''}
                  onChange={(e) => setReflection({ ...reflection, gotDone: e.target.value })}
                  autoFocus
                />
              </label>
              <label className="field">
                What should be done next?
                <textarea
                  className="notes"
                  placeholder="Follow-ups, gaps to close, outreach, next applications…"
                  value={reflection.doNext ?? ''}
                  onChange={(e) => setReflection({ ...reflection, doNext: e.target.value })}
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
            <p className="kicker">Look back</p>
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
            <p className="muted">Review the take, then capture what matters.</p>
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
            <label className="field">
              What went well
              <textarea
                className="notes"
                placeholder="What landed — clarity, presence, structure…"
                value={reflection.wentWell}
                onChange={(e) => setReflection((prev) => ({ ...prev, wentWell: e.target.value }))}
              />
            </label>
            <label className="field">
              What could be improved
              <textarea
                className="notes"
                placeholder="What to tighten next time…"
                value={reflection.couldImprove}
                onChange={(e) =>
                  setReflection((prev) => ({ ...prev, couldImprove: e.target.value }))
                }
              />
            </label>
            <label className="field">
              Additional Notes (optional)
              <textarea
                className="notes"
                placeholder="Anything else worth keeping."
                value={reflection.additionalNotes}
                onChange={(e) =>
                  setReflection((prev) => ({ ...prev, additionalNotes: e.target.value }))
                }
              />
            </label>
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
  const isAppsBlock = session.kind === 'apps-block' && blocking
  const wideBlock = isDsaBlock || isAppsBlock

  return (
    <div
      className={`studio-frame${isDsaBlock ? ' dsa-session-frame' : ''}${isAppsBlock ? ' apps-session-frame' : ''}${paused ? ' is-paused' : ''}`}
    >
      <div className={wideBlock ? (isDsaBlock ? 'dsa-session-chrome' : 'apps-session-chrome') : undefined}>
        <header className="studio-top">
          <div>
            {wideBlock ? (
              <>
                <h1 className="studio-session-title">{SESSION_META[session.kind].title}</h1>
                {isAppsBlock && phase.prompt && phase.prompt !== SESSION_META['apps-block'].title ? (
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    {phase.prompt}
                  </p>
                ) : null}
                {!isAppsBlock && timesUp ? (
                  <p className="muted" style={{ margin: '4px 0 0' }}>
                    Goal time reached — keep going if you want
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <p className="kicker">
                  {phaseTitle} · {session.currentPhaseIndex + 1}/{session.phases.length}
                </p>
                {timesUp ? (
                  <strong>Goal time reached — keep going if you want</strong>
                ) : phaseLabel ? (
                  <strong>{phaseLabel}</strong>
                ) : null}
              </>
            )}
          </div>
          <div className="studio-controls">
            {isAppsBlock ? (
              <div className="apps-session-clock">
                <Timer
                  key={`${phase.id}-${session.phaseStartedAt ?? ''}-${session.phasePausedElapsedSec ?? 'run'}`}
                  elapsedSec={timerElapsed}
                  startedAt={timerStartedAt}
                  targetSec={timerTarget}
                  running={!paused}
                  onExpire={setTimesUp}
                  variant="elapsed"
                />
                <button
                  className="apps-session-clock-toggle"
                  type="button"
                  onClick={togglePause}
                  aria-label={paused ? 'Resume timer' : 'Pause timer'}
                  title={paused ? 'Resume' : 'Pause'}
                >
                  {paused ? (
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <path d="M5 3.2v9.6L13 8 5 3.2z" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
                      <rect x="3.5" y="3" width="3" height="10" rx="0.75" fill="currentColor" />
                      <rect x="9.5" y="3" width="3" height="10" rx="0.75" fill="currentColor" />
                    </svg>
                  )}
                </button>
              </div>
            ) : (
              <button
                className={paused ? 'btn' : 'btn ghost'}
                type="button"
                onClick={togglePause}
                disabled={workLocked}
              >
                {paused ? 'Resume' : 'Pause'}
              </button>
            )}
            <button className={timesUp ? 'btn' : 'btn ghost'} type="button" onClick={advance}>
              {isAppsBlock ? 'End Session' : 'Next'}
            </button>
          </div>
        </header>
        {isDsaBlock ? (
          <div className="dsa-sticky-timer">
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
          </div>
        ) : null}
      </div>
      <div className={`studio-body${wideBlock ? (isDsaBlock ? ' dsa-session-body' : ' apps-session-body') : ''}`}>
        <article className={`prompt${wideBlock ? (isDsaBlock ? ' dsa-session-prompt' : ' apps-session-prompt') : ''}`}>
          {!wideBlock ? (
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
          ) : null}
          {!blocking && (
            <p className="muted" style={{ marginBottom: 10, textAlign: 'center' }}>
              {workLocked
                ? 'Time is up. Your current work is saved. Move on to the next step.'
                : thinking
                  ? 'Organize in your head. Do not write.'
                  : drafting
                    ? 'Write the answer you would actually say. Tight, not a novel.'
                    : phase.kind === 'speak'
                      ? 'Speak. No notes.'
                      : 'The draft is hidden. You can practice without recording.'}
            </p>
          )}
          {!wideBlock ? <h1 style={{ textAlign: 'center' }}>{phase.prompt}</h1> : null}
          {isDsaBlock ? (
            <DsaSessionPanel
              entries={dsaEntries}
              notes={answer?.draftNotes ?? ''}
              onNotes={(value) =>
                updateAnswer(
                  { questionId: phase.questionId, storyId: phase.storyId },
                  { draftNotes: value },
                )
              }
            />
          ) : null}
          {isAppsBlock ? (
            <AppsSessionPanel
              openIds={session.appsApplicationIds ?? []}
              activeId={session.appsActiveId ?? null}
              bank={state.applications}
              onSessionApps={({ openIds: appsApplicationIds, activeId: appsActiveId }) =>
                patch({ appsApplicationIds, appsActiveId })
              }
              onUpsert={(application) =>
                dispatch({ type: 'upsert-application', application })
              }
              onDelete={(id) => dispatch({ type: 'delete-application', id })}
            />
          ) : null}
          {drafting ? (
            <textarea
              className="notes"
              placeholder="Situation, the hard part, the choice, what happened — in language you can speak."
              value={answer?.draftNotes ?? ''}
              disabled={workLocked}
              onChange={(e) => {
                if (workLocked) return
                updateAnswer(
                  { questionId: phase.questionId, storyId: phase.storyId },
                  { draftNotes: e.target.value },
                )
              }}
              style={{ marginTop: 20 }}
            />
          ) : null}
          {speaking ? (
            <>
              <Recorder
                audioId={answer?.audioId}
                mediaKind={answer?.mediaKind}
                transcript={answer?.transcript ?? ''}
                disabled={workLocked}
                onChange={(next) => {
                  if (next.audioId) setRecordHint('')
                  updateAnswer({ questionId: phase.questionId, storyId: phase.storyId }, next)
                }}
              />
              {recordHint ? <p className="muted">{recordHint}</p> : null}
            </>
          ) : null}
        </article>
      </div>
    </div>
  )
}

import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { DsaStatsBar } from '../components/DsaStatsBar'
import { QuestionRecap } from '../components/QuestionRecap'
import { dsaDifficultyBucket } from '../lib/dsaStats'
import { formatClock, formatWhen } from '../lib/ids'
import { historyForKind } from '../lib/sessionPlan'
import { deleteSessionMedia } from '../lib/storage'
import { CATEGORIES, CATEGORY_LABEL, SESSION_META, type PracticeSession } from '../lib/types'
import { useStore } from '../state/Store'

export function History() {
  const { state, dispatch } = useStore()
  const { id } = useParams()
  const navigate = useNavigate()
  const selected = id ? state.sessions.find((s) => s.id === id) : undefined

  function removeSession(session: PracticeSession) {
    void deleteSessionMedia(session)
    dispatch({ type: 'delete-session', id: session.id })
  }

  if (!selected) return <Navigate to="/" replace />

  const history = historyForKind(selected.kind)
  const dsaAnswer = selected.kind === 'dsa-block' ? selected.answers.find((a) => a.questionId === 'dsa-block') : undefined

  return (
    <div className="stack">
      <Link className="muted" to={history}>
        ← Back
      </Link>
      <p className="kicker">{SESSION_META[selected.kind].title}</p>
      <h1>{selected.completedAt ? formatWhen(selected.completedAt) : 'In progress'}</h1>
      <div className="row">
        {CATEGORIES.map((c) => {
          const n = selected.categoryMinutes[c]
          if (!n) return null
          return (
            <span className="chip" key={c}>
              {CATEGORY_LABEL[c]} · {Math.round(n)}m
            </span>
          )
        })}
      </div>
      {selected.reflection?.note.trim() ? (
        <section className="card">
          <p className="kicker">{selected.kind === 'dsa-block' ? 'Key Takeaways' : 'Note'}</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{selected.reflection.note}</p>
        </section>
      ) : null}
      {selected.kind === 'dsa-block' ? (
        <>
          <DsaStatsBar entries={selected.dsaRetrieved ?? []} />
          <section className="card">
            <p className="kicker">Retrieved from tracker</p>
            {selected.dsaRetrieved?.length ? (
              <div className="cues">
                {selected.dsaRetrieved.map((r, i) => {
                  const bucket = dsaDifficultyBucket(r.difficulty)
                  return (
                    <section className="cue dsa-log-cue" key={r.id ?? `${r.problem}-${i}`}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>Problem {i + 1}</b>
                        {r.difficulty ? (
                          <span className={`dsa-diff-chip${bucket ? ` dsa-diff-${bucket}` : ''}`}>
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
                          Tracker notes: {r.notes}
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
              <p className="muted">No tracker rows were saved for this session.</p>
            )}

            <p className="kicker" style={{ marginTop: 16 }}>
              Notes you added
            </p>
            {dsaAnswer?.draftNotes.trim() ? (
              <p style={{ whiteSpace: 'pre-wrap' }}>{dsaAnswer.draftNotes}</p>
            ) : (
              <p className="muted">No notes added.</p>
            )}
          </section>
        </>
      ) : (
        selected.answers.map((a, i) => (
          <QuestionRecap key={a.questionId + (a.storyId ?? '')} answer={a} index={i} readOnly />
        ))
      )}
      <div>
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            if (!window.confirm('Delete this session? Recordings for it go too.')) return
            removeSession(selected)
            navigate(history)
          }}
        >
          Delete session
        </button>
      </div>
    </div>
  )
}

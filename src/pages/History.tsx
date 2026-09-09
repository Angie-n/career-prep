import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { QuestionRecap } from '../components/QuestionRecap'
import { formatWhen } from '../lib/ids'
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
          <p className="kicker">Note</p>
          <p style={{ whiteSpace: 'pre-wrap' }}>{selected.reflection.note}</p>
        </section>
      ) : null}
      {selected.answers.map((a, i) => (
        <QuestionRecap key={a.questionId + (a.storyId ?? '')} answer={a} index={i} readOnly />
      ))}
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

import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { AppsSessionPanel } from '../components/AppsSessionPanel'
import { ItemOverflowMenu } from '../components/ItemOverflowMenu'
import { QuestionRecap } from '../components/QuestionRecap'
import { formatWhen } from '../lib/ids'
import { historyForKind } from '../lib/sessionPlan'
import { deleteSessionMedia } from '../lib/storage'
import { CATEGORIES, CATEGORY_LABEL, SESSION_META, reflectionHasContent, type PracticeSession } from '../lib/types'
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
      <div className="apps-bank-detail-head-row">
        <Link className="apps-bank-back" to={history}>
          ← Back
        </Link>
        <ItemOverflowMenu
          label="Session options"
          deleteLabel="Delete session"
          onDelete={() => {
            if (!window.confirm('Delete this session? Recordings for it go too.')) return
            removeSession(selected)
            navigate(history)
          }}
        />
      </div>
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
      {selected.reflection && reflectionHasContent(selected.reflection) ? (
        <section className="card stack">
          {selected.kind === 'apps-block' ? (
            <>
              {selected.reflection.gotDone?.trim() ? (
                <div>
                  <p className="kicker">What did you get done?</p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{selected.reflection.gotDone}</p>
                </div>
              ) : null}
              {selected.reflection.doNext?.trim() ? (
                <div>
                  <p className="kicker">What should be done next?</p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{selected.reflection.doNext}</p>
                </div>
              ) : null}
              {selected.reflection.note?.trim() ? (
                <div>
                  <p className="kicker">Note</p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{selected.reflection.note}</p>
                </div>
              ) : null}
            </>
          ) : (
            <>
              {selected.reflection.wentWell.trim() ? (
                <>
                  <p className="kicker">What went well</p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{selected.reflection.wentWell}</p>
                </>
              ) : null}
              {selected.reflection.couldImprove.trim() ? (
                <>
                  <p className="kicker">What could be improved</p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{selected.reflection.couldImprove}</p>
                </>
              ) : null}
              {(selected.reflection.additionalNotes.trim() || selected.reflection.note?.trim()) ? (
                <>
                  <p className="kicker">Additional notes</p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {selected.reflection.additionalNotes || selected.reflection.note}
                  </p>
                </>
              ) : null}
            </>
          )}
        </section>
      ) : null}
      {selected.kind === 'apps-block' ? (
        <section className="card apps-history-card">
          <p className="kicker">Applications</p>
          <AppsSessionPanel
            openIds={selected.appsApplicationIds ?? []}
            activeId={selected.appsActiveId ?? selected.appsApplicationIds?.[0] ?? null}
            bank={state.applications}
            readOnly
          />
        </section>
      ) : (
        selected.answers.map((a, i) => (
          <QuestionRecap key={a.questionId + (a.storyId ?? '')} answer={a} index={i} readOnly />
        ))
      )}
    </div>
  )
}

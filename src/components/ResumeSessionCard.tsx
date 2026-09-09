import { useNavigate } from 'react-router-dom'
import { activeSessionPath } from '../lib/sessionPlan'
import { deleteSessionMedia } from '../lib/storage'
import { CATEGORY_BY_KIND, CATEGORY_LABEL, SESSION_META, type PracticeSession } from '../lib/types'
import { useStore } from '../state/Store'

export function ResumeSessionCard({
  session,
  headingLevel = 'h1',
}: {
  session: PracticeSession
  headingLevel?: 'h1' | 'h2'
}) {
  const { dispatch } = useStore()
  const navigate = useNavigate()
  const meta = SESSION_META[session.kind]
  const category = CATEGORY_BY_KIND[session.kind]
  const Title = headingLevel

  function discard() {
    if (!window.confirm('Discard this in-progress session? Progress in this block will be lost.')) return
    void deleteSessionMedia(session)
    dispatch({ type: 'abandon-session', id: session.id })
  }

  return (
    <section className={`card action cat-${category}`}>
      <p className="kicker">In progress</p>
      <Title>{meta.title}</Title>
      <p className="lead">
        Resume your {CATEGORY_LABEL[category].toLowerCase()} session — timer and answers are saved.
      </p>
      <div className="row">
        <button className="btn" type="button" onClick={() => navigate(activeSessionPath(session.id))}>
          Resume
        </button>
        <button className="btn ghost" type="button" onClick={discard}>
          Discard
        </button>
      </div>
    </section>
  )
}

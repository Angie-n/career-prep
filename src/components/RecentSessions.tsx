import { useNavigate } from 'react-router-dom'
import { ItemOverflowMenu } from './ItemOverflowMenu'
import { sessionsForCategory } from '../lib/insights'
import { formatWhen } from '../lib/ids'
import { deleteSessionMedia } from '../lib/storage'
import { SESSION_META, type Category, type PracticeSession } from '../lib/types'
import { useStore } from '../state/Store'

function sessionListMeta(s: PracticeSession): string {
  const when = s.completedAt ? formatWhen(s.completedAt) : ''
  if (s.kind === 'apps-block') {
    const n = s.appsApplicationIds?.length ?? 0
    const apps =
      n === 0 ? 'No applications' : `${n} application${n === 1 ? '' : 's'}`
    return [when, apps].filter(Boolean).join(' · ')
  }
  if (s.kind === 'dsa-block') {
    const n = s.dsaRetrieved?.length ?? 0
    const rows = n === 0 ? 'No tracker rows' : `${n} tracker row${n === 1 ? '' : 's'}`
    return [when, rows].filter(Boolean).join(' · ')
  }
  const answered = s.answers.length
  const answers =
    answered === 0 ? 'No answers' : `${answered} answer${answered === 1 ? '' : 's'}`
  return [when, answers].filter(Boolean).join(' · ')
}

export function RecentSessions({ category }: { category: Category }) {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const sessions = sessionsForCategory(state, category)

  if (sessions.length === 0) {
    return <p className="muted">No sessions yet in this category.</p>
  }

  return (
    <div className="apps-bank-list">
      {sessions.map((s) => (
        <article className="apps-bank-card" key={s.id}>
          <button
            type="button"
            className="apps-bank-card-open"
            onClick={() => navigate(`/history/${s.id}`)}
          >
            <div className="apps-bank-card-main">
              <h2>{SESSION_META[s.kind].title}</h2>
              <p className="muted">{sessionListMeta(s)}</p>
            </div>
          </button>
          <ItemOverflowMenu
            label="Session options"
            deleteLabel="Delete session"
            onDelete={() => {
              if (!window.confirm('Delete this session? Recordings for it go too.')) return
              void deleteSessionMedia(s)
              dispatch({ type: 'delete-session', id: s.id })
            }}
          />
        </article>
      ))}
    </div>
  )
}

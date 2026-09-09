import { Link } from 'react-router-dom'
import { sessionsForCategory } from '../lib/insights'
import { formatWhen } from '../lib/ids'
import { deleteSessionMedia } from '../lib/storage'
import { SESSION_META, type Category } from '../lib/types'
import { useStore } from '../state/Store'

export function RecentSessions({ category }: { category: Category }) {
  const { state, dispatch } = useStore()
  const sessions = sessionsForCategory(state, category).slice(0, 8)

  if (sessions.length === 0) {
    return (
      <section className="card quiet list-panel">
        <p className="kicker">Recent</p>
        <h2>Sessions</h2>
        <p className="empty">None yet in this category.</p>
      </section>
    )
  }

  return (
    <section className="card quiet list-panel">
      <p className="kicker">Recent</p>
      <h2>Sessions</h2>
      <div className="list">
        {sessions.map((s) => (
          <div className="list-item" key={s.id}>
            <div>
              <strong>{SESSION_META[s.kind].title}</strong>
              <div className="muted">
                {s.completedAt ? formatWhen(s.completedAt) : ''}
                {s.reflection?.note.trim() ? ` · ${s.reflection.note.trim().slice(0, 80)}` : ''}
              </div>
            </div>
            <div className="row">
              <Link className="btn subtle" to={`/history/${s.id}`}>
                Open
              </Link>
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  if (!window.confirm('Delete this session?')) return
                  void deleteSessionMedia(s)
                  dispatch({ type: 'delete-session', id: s.id })
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

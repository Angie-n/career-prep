import { Link } from 'react-router-dom'
import { CategorySubnav } from '../components/CategorySubnav'
import {
  APPLICATION_STATUS_LABEL,
  applicationLabel,
} from '../lib/types'
import { useStore } from '../state/Store'

export function ApplicationsBank() {
  const { state, dispatch } = useStore()
  const apps = [...state.applications].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )

  return (
    <div className="stack">
      <div className="page-head">
        <p className="kicker">Applications</p>
        <h1>Saved</h1>
        <p className="lead">
          Roles and companies you’ve marked up. Open them again from an Apply Yourself block.
        </p>
      </div>

      <CategorySubnav category="applications" />

      {apps.length === 0 ? (
        <p className="muted">
          No saved applications yet. Start an Apply Yourself session and add one.
        </p>
      ) : (
        <div className="apps-bank-list">
          {apps.map((app) => (
            <article className="card apps-bank-card" key={app.id}>
              <div className="apps-bank-card-main">
                <h2>{applicationLabel(app)}</h2>
                <p className="muted">
                  {app.status === 'not-submitted' || !app.submittedAt
                    ? 'Unsubmitted'
                    : `${APPLICATION_STATUS_LABEL[app.status]} · ${new Date(
                        app.submittedAt,
                      ).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}`}
                  {app.companyKey ? ` · ${app.companyKey}` : ''}
                </p>
                <p className="faint">
                  {app.jobDoc.annotations.length
                    ? `${app.jobDoc.annotations.length} JD comment${app.jobDoc.annotations.length === 1 ? '' : 's'}`
                    : 'No JD comments'}
                  {app.notes.length ? ` · ${app.notes.length} note${app.notes.length === 1 ? '' : 's'}` : ''}
                  {app.links.length ? ` · ${app.links.length} link${app.links.length === 1 ? '' : 's'}` : ''}
                </p>
              </div>
              <div className="row">
                <Link className="btn ghost" to="/applications">
                  Open in session
                </Link>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => {
                    if (!window.confirm('Delete this saved application?')) return
                    dispatch({ type: 'delete-application', id: app.id })
                  }}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

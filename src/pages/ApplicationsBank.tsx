import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useState } from 'react'
import { ApplicationCompose } from '../components/AppsSessionPanel'
import { CategorySubnav } from '../components/CategorySubnav'
import { ItemOverflowMenu } from '../components/ItemOverflowMenu'
import { touchApplication } from '../lib/applications'
import {
  APPLICATION_STATUS_LABEL,
  applicationLabel,
  type Application,
  type ApplicationComposeStep,
} from '../lib/types'
import { useStore } from '../state/Store'

function appListMeta(app: Application): string {
  if (app.status === 'not-submitted' || !app.submittedAt) return 'Unsubmitted'
  return `${APPLICATION_STATUS_LABEL[app.status]} · ${new Date(app.submittedAt).toLocaleDateString(
    undefined,
    { month: 'short', day: 'numeric', year: 'numeric' },
  )}`
}

export function ApplicationsBank() {
  const { id } = useParams<{ id?: string }>()
  if (id) return <ApplicationQuickView id={id} />
  return <ApplicationsList />
}

function ApplicationsList() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const apps = [...state.applications].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  )

  return (
    <div className="stack">
      <div className="page-head">
        <p className="kicker">Applications</p>
        <h1>Applications</h1>
        <p className="lead">
          Roles and companies you’ve marked up. Open one to review or edit anytime.
        </p>
      </div>

      <CategorySubnav category="applications" />

      {apps.length === 0 ? (
        <p className="muted">
          No applications yet. Start an Apply Yourself session and add one.
        </p>
      ) : (
        <div className="apps-bank-list">
          {apps.map((app) => (
            <article className="apps-bank-card" key={app.id}>
              <button
                type="button"
                className="apps-bank-card-open"
                onClick={() => navigate(`/applications/saved/${app.id}`)}
              >
                <div className="apps-bank-card-main">
                  <h2>{applicationLabel(app)}</h2>
                  <p className="muted">{appListMeta(app)}</p>
                  <p className="faint">
                    {app.jobDoc.annotations.length
                      ? `${app.jobDoc.annotations.length} JD comment${
                          app.jobDoc.annotations.length === 1 ? '' : 's'
                        }`
                      : 'No JD comments'}
                    {app.notes.length
                      ? ` · ${app.notes.length} note${app.notes.length === 1 ? '' : 's'}`
                      : ''}
                    {app.links.length
                      ? ` · ${app.links.length} link${app.links.length === 1 ? '' : 's'}`
                      : ''}
                  </p>
                </div>
              </button>
              <ItemOverflowMenu
                label="Application options"
                deleteLabel="Delete application"
                onDelete={() => {
                  if (
                    !window.confirm(
                      `Delete ${applicationLabel(app)}? This cannot be undone.`,
                    )
                  ) {
                    return
                  }
                  dispatch({ type: 'delete-application', id: app.id })
                }}
              />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

function ApplicationQuickView({ id }: { id: string }) {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const app = state.applications.find((a) => a.id === id)
  const [step, setStep] = useState<Exclude<ApplicationComposeStep, 'done'>>('identity')

  if (!app) {
    return <Navigate to="/applications/saved" replace />
  }

  const current = app

  return (
    <div className="stack apps-bank-detail">
      <div className="apps-bank-detail-head">
        <div className="apps-bank-detail-head-row">
          <Link className="apps-bank-back" to="/applications/saved">
            ← Applications
          </Link>
          <ItemOverflowMenu
            label="Application options"
            deleteLabel="Delete application"
            onDelete={() => {
              if (
                !window.confirm(
                  `Delete ${applicationLabel(current)}? This cannot be undone.`,
                )
              ) {
                return
              }
              dispatch({ type: 'delete-application', id: current.id })
              navigate('/applications/saved')
            }}
          />
        </div>
        <h1>{applicationLabel(current)}</h1>
        <p className="muted apps-bank-detail-meta">{appListMeta(current)}</p>
      </div>

      <div className="apps-bank-detail-panel">
        <ApplicationCompose
          app={current}
          step={step}
          onPatch={(partial) =>
            dispatch({
              type: 'upsert-application',
              application: touchApplication(current, partial),
            })
          }
          onStep={setStep}
        />
      </div>
    </div>
  )
}

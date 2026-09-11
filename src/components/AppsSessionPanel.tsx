import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { JdDocPanel } from './JdDocPanel'
import {
  isEmptyApplication,
  newApplicationDraft,
  newApplicationLink,
  newApplicationNote,
  touchApplication,
} from '../lib/applications'
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABEL,
  applicationLabel,
  type Application,
  type ApplicationComposeStep,
  type ApplicationNote,
  type ApplicationStatus,
} from '../lib/types'

const STEP_LABEL: Record<Exclude<ApplicationComposeStep, 'done'>, string> = {
  identity: 'Role & company',
  jd: 'Job description',
  fit: 'Fit',
  links: 'Links',
  notes: 'Notes',
  status: 'Status',
}

const SUGGESTED_LINK_LABELS = ['Resume', 'Job Posting'] as const

function formatAppTabDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function toDateInputValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Change calendar day while keeping the original local time-of-day. */
function applyDateKeepingTime(iso: string, ymd: string): string {
  const parts = ymd.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const day = parts[2]
  if (!y || !m || !day) return iso
  const prev = new Date(iso)
  const next = Number.isNaN(prev.getTime()) ? new Date() : new Date(prev.getTime())
  next.setFullYear(y, m - 1, day)
  return next.toISOString()
}

function appTabDateLabel(app: Application): string {
  if (app.status === 'not-submitted' || !app.submittedAt) return 'Unsubmitted'
  return formatAppTabDate(app.submittedAt) || 'Unsubmitted'
}

export function AppsSessionPanel({
  openIds,
  activeId,
  bank,
  onSessionApps,
  onUpsert,
  onDelete,
  readOnly = false,
}: {
  openIds: string[]
  activeId: string | null
  bank: Application[]
  onSessionApps?: (next: { openIds: string[]; activeId: string | null }) => void
  onUpsert?: (application: Application) => void
  onDelete?: (id: string) => void
  readOnly?: boolean
}) {
  const [viewStepById, setViewStepById] = useState<Record<string, Exclude<ApplicationComposeStep, 'done'>>>(
    {},
  )
  const [browseActiveId, setBrowseActiveId] = useState<string | null>(null)

  const byId = useMemo(() => new Map(bank.map((a) => [a.id, a])), [bank])
  const openApps = openIds.map((id) => byId.get(id)).filter((a): a is Application => !!a)
  const resolvedActiveId =
    browseActiveId && openIds.includes(browseActiveId)
      ? browseActiveId
      : activeId && openIds.includes(activeId)
        ? activeId
        : openApps[0]?.id ?? null
  const active = (resolvedActiveId && byId.get(resolvedActiveId)) || openApps[0] || null
  const loadable = bank.filter((a) => !openIds.includes(a.id) && a.composeStep === 'done')

  useEffect(() => {
    setBrowseActiveId(null)
  }, [activeId])

  useEffect(() => {
    if (browseActiveId && !openIds.includes(browseActiveId)) {
      setBrowseActiveId(null)
    }
  }, [browseActiveId, openIds])

  function selectApp(id: string) {
    setBrowseActiveId(id)
    onSessionApps?.({ openIds, activeId: id })
  }

  function viewStepFor(app: Application): Exclude<ApplicationComposeStep, 'done'> {
    const saved = viewStepById[app.id]
    if (saved) return saved
    if (app.composeStep === 'done') return 'identity'
    return app.composeStep
  }

  function createNew() {
    if (readOnly || !onUpsert || !onSessionApps) return
    const draft = newApplicationDraft({ composeStep: 'identity', status: 'not-submitted' })
    onUpsert(draft)
    setBrowseActiveId(draft.id)
    onSessionApps({ openIds: [...openIds, draft.id], activeId: draft.id })
    setViewStepById((prev) => ({ ...prev, [draft.id]: 'identity' }))
  }

  function loadExisting(id: string) {
    if (readOnly || !onSessionApps || !onUpsert) return
    const app = byId.get(id)
    if (!app) return
    if (app.composeStep !== 'done') {
      onUpsert(touchApplication(app, { composeStep: 'done' }))
    }
    setBrowseActiveId(id)
    onSessionApps({
      openIds: openIds.includes(id) ? openIds : [...openIds, id],
      activeId: id,
    })
    setViewStepById((prev) => ({ ...prev, [id]: prev[id] ?? 'identity' }))
  }

  function removeFromSession(id: string) {
    if (readOnly || !onSessionApps) return
    const app = byId.get(id)
    if (app && isEmptyApplication(app) && onDelete) {
      onDelete(id)
      return
    }
    const nextIds = openIds.filter((openId) => openId !== id)
    const nextActive =
      activeId === id || !nextIds.includes(activeId ?? '')
        ? nextIds[0] ?? null
        : activeId
    onSessionApps({ openIds: nextIds, activeId: nextActive })
  }

  function deleteApplication(id: string) {
    if (readOnly || !onDelete) return
    const app = byId.get(id)
    const label =
      app && (app.role.trim() || app.company.trim())
        ? applicationLabel(app)
        : 'this application'
    if (
      !window.confirm(
        `Delete ${label}? This removes it from your applications bank and cannot be undone.`,
      )
    ) {
      return
    }
    onDelete(id)
  }

  function patchActive(partial: Partial<Application>) {
    if (!active || !onUpsert) return
    const role = (partial.role ?? active.role).trim()
    const company = (partial.company ?? active.company).trim()
    const nextPartial =
      active.composeStep !== 'done' && role && company
        ? { ...partial, composeStep: 'done' as const }
        : partial
    if (nextPartial.composeStep === 'done') {
      setViewStepById((prev) => ({
        ...prev,
        [active.id]: prev[active.id] ?? viewStepFor(active),
      }))
    }
    onUpsert(touchApplication(active, nextPartial))
  }

  function goStep(step: Exclude<ApplicationComposeStep, 'done'>) {
    if (!active) return
    setViewStepById((prev) => ({ ...prev, [active.id]: step }))
    if (active.composeStep !== 'done') {
      patchActive({ composeStep: step })
    }
  }

  return (
    <div className="apps-session">
      <div className="apps-session-controls">
        <SessionAppBar
          readOnly={readOnly}
          loadable={loadable}
          onNew={createNew}
          onLoad={loadExisting}
        />
      </div>

      <div className="apps-session-workspace">
        <AppTabStrip
          openApps={openApps}
          activeId={active?.id ?? null}
          readOnly={readOnly}
          onSelect={selectApp}
          onRemove={removeFromSession}
        />

        <div className="apps-application-panel">
          {active ? (
            <div className="apps-application-panel-head">
              <div className="apps-application-panel-head-main">
                <div className="apps-application-panel-kicker">This application</div>
                <div className="apps-application-panel-title">
                  {active.role.trim() || active.company.trim()
                    ? applicationLabel(active)
                    : 'New application'}
                </div>
                <div className="apps-application-panel-meta">
                  {appTabDateLabel(active)}
                  {active.status !== 'not-submitted'
                    ? ` · ${APPLICATION_STATUS_LABEL[active.status]}`
                    : ''}
                </div>
              </div>
              {!readOnly && onDelete ? (
                <ApplicationOverflowMenu onDelete={() => deleteApplication(active.id)} />
              ) : null}
            </div>
          ) : (
            <div className="apps-application-panel-kicker">This application</div>
          )}
          {!active ? (
            <div className="apps-empty-session">
              <p className="muted">
                {readOnly
                  ? 'No applications were attached to this session.'
                  : 'Start a new application or load one you’ve already started.'}
              </p>
            </div>
          ) : (
            <ComposeFlow
              key={active.id}
              app={active}
              step={viewStepFor(active)}
              readOnly={readOnly}
              onPatch={patchActive}
              onStep={goStep}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ApplicationOverflowMenu({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`apps-application-menu${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        className="apps-application-menu-trigger"
        type="button"
        aria-label="Application options"
        aria-expanded={open}
        aria-haspopup="menu"
        title="Options"
        onClick={() => setOpen((v) => !v)}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <circle cx="8" cy="5" r="1.5" fill="currentColor" />
          <circle cx="8" cy="11" r="1.5" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <div className="apps-application-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="apps-application-menu-item"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
          >
            Delete application
          </button>
        </div>
      ) : null}
    </div>
  )
}

function SessionAppBar({
  readOnly,
  loadable,
  onNew,
  onLoad,
}: {
  readOnly: boolean
  loadable: Application[]
  onNew: () => void
  onLoad: (id: string) => void
}) {
  return (
    <div className="apps-session-bar">
      <div className="apps-session-bar-label">This session</div>
      {!readOnly ? (
        <div className="apps-session-add">
          <button
            className="apps-session-add-btn"
            type="button"
            onClick={onNew}
            aria-label="Create a new application"
          >
            + New Application
          </button>
          <LoadApplicationSelect items={loadable} onPick={onLoad} />
        </div>
      ) : null}
    </div>
  )
}

function AppTabStrip({
  openApps,
  activeId,
  readOnly,
  onSelect,
  onRemove,
}: {
  openApps: Application[]
  activeId: string | null
  readOnly: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ left: false, right: false })

  function updateOverflow() {
    const el = scrollerRef.current
    if (!el) {
      setOverflow({ left: false, right: false })
      return
    }
    const max = el.scrollWidth - el.clientWidth
    const left = el.scrollLeft > 2
    const right = max > 2 && el.scrollLeft < max - 2
    setOverflow((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    )
  }

  useLayoutEffect(() => {
    updateOverflow()
    const el = scrollerRef.current
    if (!el) return
    const onScroll = () => updateOverflow()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateOverflow) : null
    ro?.observe(el)
    window.addEventListener('resize', updateOverflow)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro?.disconnect()
      window.removeEventListener('resize', updateOverflow)
    }
  }, [openApps.length, activeId])

  useLayoutEffect(() => {
    const el = scrollerRef.current
    if (!el || !activeId) return
    const tab = el.querySelector<HTMLElement>(`[data-app-tab-id="${activeId}"]`)
    tab?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [activeId, openApps.length])

  function scrollByDir(dir: -1 | 1) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: 'smooth' })
  }

  const canScroll = overflow.left || overflow.right

  return (
    <div
      className={`apps-app-tabstrip${canScroll ? ' is-scrollable' : ''}${
        overflow.left ? ' has-left' : ''
      }${overflow.right ? ' has-right' : ''}`}
    >
      {overflow.left ? (
        <button
          className="apps-app-tabstrip-nav apps-app-tabstrip-nav-left"
          type="button"
          aria-label="Scroll to earlier applications"
          onClick={() => scrollByDir(-1)}
        >
          ‹
        </button>
      ) : null}
      <div
        className="apps-app-tabstrip-inner"
        ref={scrollerRef}
        role="tablist"
        aria-label="Applications in this session"
      >
        {openApps.length ? (
          openApps.map((app) => (
            <div
              key={app.id}
              data-app-tab-id={app.id}
              className={`apps-app-tab${activeId === app.id ? ' is-active' : ''}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeId === app.id}
                className="apps-app-tab-main"
                onClick={() => onSelect(app.id)}
                title={
                  app.role.trim() || app.company.trim()
                    ? `${applicationLabel(app)} · ${appTabDateLabel(app)}`
                    : 'New application'
                }
              >
                <span
                  className={`apps-app-tab-company${app.company.trim() ? '' : ' is-placeholder'}`}
                >
                  {app.company.trim() || 'Company'}
                </span>
                <span className={`apps-app-tab-role${app.role.trim() ? '' : ' is-placeholder'}`}>
                  {app.role.trim() || 'Role'}
                </span>
                <span className="apps-app-tab-status">
                  {appTabDateLabel(app)}
                  {app.status !== 'not-submitted'
                    ? ` · ${APPLICATION_STATUS_LABEL[app.status]}`
                    : ''}
                </span>
              </button>
              {!readOnly ? (
                <button
                  className="apps-app-tab-close"
                  type="button"
                  aria-label={`Remove ${
                    app.role.trim() || app.company.trim()
                      ? applicationLabel(app)
                      : 'application'
                  } from this session`}
                  title="Remove from session"
                  onClick={() => onRemove(app.id)}
                >
                  ×
                </button>
              ) : null}
            </div>
          ))
        ) : (
          <p className="muted apps-session-bar-empty">No applications open yet</p>
        )}
      </div>
      {overflow.right ? (
        <button
          className="apps-app-tabstrip-nav apps-app-tabstrip-nav-right"
          type="button"
          aria-label="Scroll to more applications"
          onClick={() => scrollByDir(1)}
        >
          ›
        </button>
      ) : null}
    </div>
  )
}

export function ApplicationCompose({
  app,
  step,
  readOnly,
  onPatch,
  onStep,
}: {
  app: Application
  step: Exclude<ApplicationComposeStep, 'done'>
  readOnly?: boolean
  onPatch: (partial: Partial<Application>) => void
  onStep: (step: Exclude<ApplicationComposeStep, 'done'>) => void
}) {
  return (
    <ComposeFlow
      app={app}
      step={step}
      readOnly={readOnly ?? false}
      onPatch={onPatch}
      onStep={onStep}
    />
  )
}

function ComposeFlow({
  app,
  step,
  readOnly,
  onPatch,
  onStep,
}: {
  app: Application
  step: Exclude<ApplicationComposeStep, 'done'>
  readOnly: boolean
  onPatch: (partial: Partial<Application>) => void
  onStep: (step: Exclude<ApplicationComposeStep, 'done'>) => void
}) {
  const canIdentity = Boolean(app.role.trim() && app.company.trim())
  const canJd = Boolean(app.jobDoc.text.trim())
  const canFit = Boolean(
    app.fitOverlap.trim() && app.fitGaps.trim() && app.fitTrajectory.trim(),
  )
  const steps = ['identity', 'jd', 'fit', 'links', 'notes', 'status'] as const
  const saved = app.composeStep === 'done'

  return (
    <div className="apps-compose">
      <div className="apps-compose-progress" aria-label="Application sections">
        {steps.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`apps-compose-step${step === s ? ' is-current' : ''}${
              stepIndex(step) > i ? ' is-done' : ''
            }`}
            onClick={() => onStep(s)}
          >
            {STEP_LABEL[s]}
          </button>
        ))}
      </div>

      {step === 'identity' ? (
        <section className="apps-compose-pane stack">
          <div>
            <h2 className="apps-compose-title">Role & company</h2>
            <p className="muted">Name the role and company for this application.</p>
          </div>
          <label className="field">
            Role
            <input
              type="text"
              value={app.role}
              disabled={readOnly}
              placeholder="e.g. Staff Engineer"
              autoFocus={!readOnly && !saved}
              onChange={(e) => onPatch({ role: e.target.value })}
            />
          </label>
          <label className="field">
            Company
            <input
              type="text"
              value={app.company}
              disabled={readOnly}
              placeholder="e.g. Acme"
              onChange={(e) => onPatch({ company: e.target.value })}
            />
          </label>
          {!readOnly ? (
            <div className="apps-compose-nav">
              <button
                className="btn"
                type="button"
                disabled={!saved && !canIdentity}
                onClick={() => onStep('jd')}
              >
                Continue
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'jd' ? (
        <section className="apps-compose-pane stack">
          <div>
            <h2 className="apps-compose-title">Job description</h2>
            <p className="muted">Paste the posting, then highlight and comment as you go.</p>
          </div>
          <JdDocPanel
            key={app.id}
            jobDoc={app.jobDoc}
            readOnly={readOnly}
            onChange={readOnly ? undefined : (jobDoc) => onPatch({ jobDoc })}
          />
          {!readOnly ? (
            <div className="apps-compose-nav">
              <button className="btn ghost" type="button" onClick={() => onStep('identity')}>
                Back
              </button>
              <button
                className="btn"
                type="button"
                disabled={!saved && !canJd}
                onClick={() => onStep('fit')}
              >
                Continue
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'fit' ? (
        <section className="apps-compose-pane apps-fit-pane stack">
          <div>
            <h2 className="apps-compose-title">Fit</h2>
            <p className="muted">Work through how this role fits you — and where it could take you.</p>
          </div>
          <label className="field">
            Where do my experience and demonstrated capabilities overlap with what they need?
            <textarea
              className="notes apps-fit-input"
              value={app.fitOverlap}
              disabled={readOnly}
              placeholder="Strengths, proof points, overlap with the posting…"
              onChange={(e) => onPatch({ fitOverlap: e.target.value })}
            />
          </label>
          <label className="field">
            Where are the meaningful gaps?
            <textarea
              className="notes apps-fit-input"
              value={app.fitGaps}
              disabled={readOnly}
              placeholder="Missing experience, weaker signals, risks to address…"
              onChange={(e) => onPatch({ fitGaps: e.target.value })}
            />
          </label>
          <label className="field">
            Why is this a good point in my career to join, and what trajectory could it give me?
            <textarea
              className="notes apps-fit-input"
              value={app.fitTrajectory}
              disabled={readOnly}
              placeholder="Timing, growth path, what this role unlocks next…"
              onChange={(e) => onPatch({ fitTrajectory: e.target.value })}
            />
          </label>
          {!readOnly ? (
            <div className="apps-compose-nav">
              <button className="btn ghost" type="button" onClick={() => onStep('jd')}>
                Back
              </button>
              <button
                className="btn"
                type="button"
                disabled={!saved && !canFit}
                onClick={() => onStep('links')}
              >
                Continue to links
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'links' ? (
        <section className="apps-compose-pane stack">
          <div>
            <h2 className="apps-compose-title">Links</h2>
            <p className="muted">Optional — resume, posting, tracker, or anything else to keep handy.</p>
          </div>
          <LinksSection app={app} readOnly={readOnly} onPatch={onPatch} />
          {!readOnly ? (
            <div className="apps-compose-nav">
              <button className="btn ghost" type="button" onClick={() => onStep('fit')}>
                Back
              </button>
              <button className="btn" type="button" onClick={() => onStep('notes')}>
                Continue to notes
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'notes' ? (
        <section className="apps-compose-pane stack">
          <div>
            <h2 className="apps-compose-title">Notes</h2>
            <p className="muted">Optional — interview prep, recruiting threads, anything useful.</p>
          </div>
          <NotesSection app={app} readOnly={readOnly} onPatch={onPatch} />
          {!readOnly ? (
            <div className="apps-compose-nav">
              <button className="btn ghost" type="button" onClick={() => onStep('links')}>
                Back
              </button>
              <button className="btn" type="button" onClick={() => onStep('status')}>
                Continue to status
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === 'status' ? (
        <section className="apps-compose-pane stack">
          <div>
            <h2 className="apps-compose-title">Status</h2>
            <p className="muted">
              When you’ve sent the application, mark it submitted. Update again as interviews and
              outcomes come in.
            </p>
          </div>
          <label className="field">
            Application status
            <select
              value={app.status}
              disabled={readOnly}
              onChange={(e) => onPatch({ status: e.target.value as ApplicationStatus })}
            >
              {APPLICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {APPLICATION_STATUS_LABEL[status]}
                </option>
              ))}
            </select>
          </label>
          <StatusLog
            statusLog={app.statusLog}
            readOnly={readOnly}
            onPatch={onPatch}
          />
          {!readOnly ? (
            <div className="apps-compose-nav">
              <button className="btn ghost" type="button" onClick={() => onStep('notes')}>
                Back
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function StatusLog({
  statusLog,
  readOnly,
  onPatch,
}: {
  statusLog: Application['statusLog']
  readOnly: boolean
  onPatch: (partial: Partial<Application>) => void
}) {
  const [editing, setEditing] = useState(false)

  return (
    <div className="apps-status-log">
      <div className="apps-status-log-head">
        <h3 className="apps-status-log-heading">Status log</h3>
        {!readOnly && statusLog.length ? (
          <button
            className="apps-inline-add apps-status-log-action"
            type="button"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Save' : 'Edit'}
          </button>
        ) : null}
      </div>
      {statusLog.length ? (
        <ul className="apps-status-log-list">
          {[...statusLog].reverse().map((event) => (
            <StatusLogRow
              key={event.id}
              event={event}
              editing={editing && !readOnly}
              onChangeAt={(at) =>
                onPatch({
                  statusLog: statusLog.map((e) => (e.id === event.id ? { ...e, at } : e)),
                })
              }
              onDelete={() =>
                onPatch({
                  statusLog: statusLog.filter((e) => e.id !== event.id),
                })
              }
            />
          ))}
        </ul>
      ) : (
        <p className="muted apps-status-log-empty">No status changes logged yet.</p>
      )}
    </div>
  )
}

function StatusLogRow({
  event,
  editing,
  onChangeAt,
  onDelete,
}: {
  event: { id: string; status: ApplicationStatus; at: string }
  editing: boolean
  onChangeAt: (at: string) => void
  onDelete: () => void
}) {
  return (
    <li className={`apps-status-log-item${editing ? ' is-editing' : ''}`}>
      <div className="apps-status-log-copy">
        <span className="apps-status-log-status">{APPLICATION_STATUS_LABEL[event.status]}</span>
        <span className="apps-status-log-when-slot">
          {editing ? (
            <input
              className="apps-status-log-date"
              type="date"
              value={toDateInputValue(event.at)}
              onChange={(e) => {
                if (!e.target.value) return
                onChangeAt(applyDateKeepingTime(event.at, e.target.value))
              }}
              aria-label={`Date for ${APPLICATION_STATUS_LABEL[event.status]}`}
            />
          ) : (
            <span className="apps-status-log-when muted">{formatAppTabDate(event.at)}</span>
          )}
        </span>
      </div>
      <button
        className="apps-status-log-action-delete"
        type="button"
        onClick={onDelete}
        tabIndex={editing ? 0 : -1}
        aria-label={`Remove ${APPLICATION_STATUS_LABEL[event.status]} from status log`}
        aria-hidden={!editing}
        disabled={!editing}
      >
        ×
      </button>
    </li>
  )
}

function NotesSection({
  app,
  readOnly,
  onPatch,
}: {
  app: Application
  readOnly: boolean
  onPatch: (partial: Partial<Application>) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(app.notes[0]?.id ?? null)
  const active = app.notes.find((n) => n.id === activeId) ?? app.notes[0] ?? null

  useEffect(() => {
    if (!app.notes.length) {
      if (activeId !== null) setActiveId(null)
      return
    }
    if (!activeId || !app.notes.some((n) => n.id === activeId)) {
      setActiveId(app.notes[app.notes.length - 1]!.id)
    }
  }, [app.notes, activeId])

  function addNote() {
    const note = newApplicationNote('')
    onPatch({ notes: [...app.notes, note] })
    setActiveId(note.id)
  }

  function patchNote(id: string, partial: Partial<Pick<ApplicationNote, 'title' | 'body'>>) {
    onPatch({
      notes: app.notes.map((n) =>
        n.id === id
          ? { ...n, ...partial, updatedAt: new Date().toISOString() }
          : n,
      ),
    })
  }

  function removeNote(id: string) {
    const note = app.notes.find((n) => n.id === id)
    if (!note) return
    if (
      (note.body.trim() || note.title.trim()) &&
      !window.confirm('Delete this note?')
    ) {
      return
    }
    const next = app.notes.filter((n) => n.id !== id)
    onPatch({ notes: next })
    if (activeId === id) setActiveId(next[next.length - 1]?.id ?? null)
  }

  if (!app.notes.length) {
    return (
      <section className="apps-extra-col apps-notes-block">
        {readOnly ? (
          <p className="muted">No notes yet.</p>
        ) : (
          <button className="apps-inline-add" type="button" onClick={addNote}>
            + Add note
          </button>
        )}
      </section>
    )
  }

  return (
    <section className="apps-extra-col apps-notes-block">
      <div className="apps-note-subtabs" role="tablist" aria-label="Notes">
        {app.notes.map((note) => {
          const selected = (active?.id ?? null) === note.id
          return (
            <button
              key={note.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`apps-note-subtab${selected ? ' is-active' : ''}`}
              onClick={() => setActiveId(note.id)}
            >
              {note.title.trim() || 'Untitled note'}
            </button>
          )
        })}
        {!readOnly ? (
          <button
            className="apps-note-subtab apps-note-subtab-add"
            type="button"
            onClick={addNote}
            aria-label="Add note"
          >
            +
          </button>
        ) : null}
      </div>

      {active ? (
        <article className="apps-note-card" role="tabpanel">
          {readOnly ? (
            <>
              <h4>{active.title.trim() || 'Untitled note'}</h4>
              <p className="apps-note-body">
                {active.body.trim() || <span className="muted">Empty</span>}
              </p>
            </>
          ) : (
            <>
              <div className="apps-note-top">
                <input
                  className="apps-note-title"
                  type="text"
                  value={active.title}
                  placeholder="Note title (e.g. Interview prep)"
                  onChange={(e) => patchNote(active.id, { title: e.target.value })}
                />
                <button
                  className="apps-comment-delete"
                  type="button"
                  aria-label="Delete note"
                  onClick={() => removeNote(active.id)}
                >
                  ×
                </button>
              </div>
              <AutoGrowNoteInput
                value={active.body}
                onChange={(body) => patchNote(active.id, { body })}
              />
            </>
          )}
        </article>
      ) : null}
    </section>
  )
}

function AutoGrowNoteInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.max(el.scrollHeight, 72)}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      className="apps-note-input"
      rows={1}
      placeholder="Prep angles, questions, takeaways…"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function LinksSection({
  app,
  readOnly,
  onPatch,
}: {
  app: Application
  readOnly: boolean
  onPatch: (partial: Partial<Application>) => void
}) {
  const existingLabels = new Set(app.links.map((l) => l.label.trim().toLowerCase()))
  const suggestions = SUGGESTED_LINK_LABELS.filter(
    (label) => !existingLabels.has(label.toLowerCase()),
  )

  function addSuggested(label: string) {
    const link = { ...newApplicationLink(), label }
    onPatch({ links: [...app.links, link] })
  }

  function addBlank() {
    onPatch({ links: [...app.links, newApplicationLink()] })
  }

  return (
    <section className="apps-extra-col apps-links-block">
      {!readOnly && suggestions.length ? (
        <div className="apps-link-suggestions">
          <span className="faint">Suggested:</span>
          {suggestions.map((label) => (
            <button
              key={label}
              className="apps-inline-chip"
              type="button"
              onClick={() => addSuggested(label)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
      {app.links.length ? (
        <div className="apps-link-list">
          {app.links.map((link) => (
            <div className="apps-link-row" key={link.id}>
              {readOnly ? (
                link.url.trim() ? (
                  <a href={link.url} target="_blank" rel="noreferrer">
                    {link.label.trim() || link.url}
                  </a>
                ) : (
                  <span className="muted">{link.label.trim() || 'Empty link'}</span>
                )
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Label"
                    value={link.label}
                    onChange={(e) =>
                      onPatch({
                        links: app.links.map((l) =>
                          l.id === link.id ? { ...l, label: e.target.value } : l,
                        ),
                      })
                    }
                  />
                  <input
                    type="url"
                    placeholder="https://"
                    value={link.url}
                    onChange={(e) =>
                      onPatch({
                        links: app.links.map((l) =>
                          l.id === link.id ? { ...l, url: e.target.value } : l,
                        ),
                      })
                    }
                  />
                  <button
                    className="apps-comment-delete"
                    type="button"
                    aria-label="Delete link"
                    onClick={() => {
                      if (
                        (link.label.trim() || link.url.trim()) &&
                        !window.confirm('Delete this link?')
                      ) {
                        return
                      }
                      onPatch({ links: app.links.filter((l) => l.id !== link.id) })
                    }}
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : readOnly ? (
        <p className="muted">No links yet.</p>
      ) : null}
      {!readOnly ? (
        <button className="apps-inline-add" type="button" onClick={addBlank}>
          + Add link
        </button>
      ) : null}
    </section>
  )
}

function LoadApplicationSelect({
  items,
  onPick,
}: {
  items: Application[]
  onPick: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((app) => {
      const hay = [
        applicationLabel(app),
        app.role,
        app.company,
        APPLICATION_STATUS_LABEL[app.status],
        appTabDateLabel(app),
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current?.contains(e.target as Node)) return
      setOpen(false)
      setQuery('')
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const disabled = items.length === 0

  return (
    <div className={`apps-load-select${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        className="apps-load-select-trigger"
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Load an existing application"
        onClick={() => {
          if (disabled) return
          setOpen((v) => !v)
          setQuery('')
        }}
      >
        <span>Load Existing Application</span>
        <span className="apps-load-select-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="apps-load-select-panel">
          <input
            ref={inputRef}
            className="apps-load-select-search"
            type="search"
            placeholder="Search role, company, status…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search applications to load"
          />
          <ul className="apps-load-select-list" role="listbox">
            {filtered.length ? (
              filtered.map((app) => (
                <li key={app.id}>
                  <button
                    type="button"
                    role="option"
                    className="apps-load-select-option"
                    onClick={() => {
                      onPick(app.id)
                      setOpen(false)
                      setQuery('')
                    }}
                  >
                    <span className="apps-load-select-option-main">{applicationLabel(app)}</span>
                    <span className="apps-load-select-option-meta">
                      {appTabDateLabel(app)}
                      {app.status !== 'not-submitted'
                        ? ` · ${APPLICATION_STATUS_LABEL[app.status]}`
                        : ''}
                    </span>
                  </button>
                </li>
              ))
            ) : (
              <li className="apps-load-select-empty muted">No matching applications</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function stepIndex(step: ApplicationComposeStep): number {
  const order: ApplicationComposeStep[] = [
    'identity',
    'jd',
    'fit',
    'links',
    'notes',
    'status',
    'done',
  ]
  return Math.max(0, order.indexOf(step))
}

import { uid } from './ids'
import { normalizeAppsJobDoc } from './jdAnnotations'
import type {
  Application,
  ApplicationLink,
  ApplicationNote,
  ApplicationStatus,
  ApplicationStatusEvent,
  ApplicationComposeStep,
  AppsJobDoc,
} from './types'
import {
  APPLICATION_COMPOSE_STEPS,
  APPLICATION_STATUSES,
  emptyApplication,
  normalizeCompanyKey,
} from './types'

export function newApplicationDraft(
  partial: Partial<Application> = {},
): Application {
  const now = new Date().toISOString()
  const company = partial.company ?? ''
  return {
    ...emptyApplication(),
    ...partial,
    id: partial.id ?? uid(),
    company,
    companyKey: normalizeCompanyKey(company),
    jobDoc: partial.jobDoc ?? emptyApplication().jobDoc,
    notes: partial.notes ?? [],
    links: partial.links ?? [],
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  }
}

export function touchApplication(app: Application, patch: Partial<Application> = {}): Application {
  const company = patch.company ?? app.company
  const nextStatus = patch.status ?? app.status
  let submittedAt =
    patch.submittedAt !== undefined ? patch.submittedAt : (app.submittedAt ?? null)
  let statusLog = patch.statusLog ?? app.statusLog ?? []

  if (patch.status !== undefined) {
    if (patch.status === 'not-submitted') {
      submittedAt = null
    } else if (patch.status === 'not-pursuing') {
      // Keep an existing submit date; don't invent one if they never applied.
    } else if (!submittedAt) {
      submittedAt = new Date().toISOString()
    }
    if (patch.status !== app.status && patch.statusLog === undefined) {
      const event: ApplicationStatusEvent = {
        id: uid(),
        status: patch.status,
        at: new Date().toISOString(),
      }
      statusLog = [...statusLog, event]
    }
  } else if (
    nextStatus !== 'not-submitted' &&
    nextStatus !== 'not-pursuing' &&
    !submittedAt
  ) {
    submittedAt = new Date().toISOString()
  }

  return {
    ...app,
    ...patch,
    company,
    companyKey: normalizeCompanyKey(company),
    statusLog,
    submittedAt,
    updatedAt: new Date().toISOString(),
  }
}

export function newApplicationNote(title = ''): ApplicationNote {
  const now = new Date().toISOString()
  return { id: uid(), title, body: '', createdAt: now, updatedAt: now }
}

/** True when an application has no meaningful content and should not be kept. */
export function isEmptyApplication(app: Application): boolean {
  if (app.role.trim() || app.company.trim()) return false
  if (app.jobDoc.text.trim()) return false
  if (app.fitOverlap.trim() || app.fitGaps.trim() || app.fitTrajectory.trim()) return false
  if (app.notes.some((n) => n.title.trim() || n.body.trim())) return false
  if (app.links.some((l) => l.label.trim() || l.url.trim())) return false
  if (app.status !== 'not-submitted') return false
  if (app.statusLog.length > 0) return false
  return true
}

export function newApplicationLink(): ApplicationLink {
  return { id: uid(), label: '', url: '' }
}

function isStatus(v: unknown): v is ApplicationStatus {
  return typeof v === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(v)
}

function migrateNote(raw: unknown): ApplicationNote | null {
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Record<string, unknown>
  const now = new Date().toISOString()
  return {
    id: typeof n.id === 'string' ? n.id : uid(),
    title: typeof n.title === 'string' ? n.title : 'Note',
    body: typeof n.body === 'string' ? n.body : '',
    createdAt: typeof n.createdAt === 'string' ? n.createdAt : now,
    updatedAt: typeof n.updatedAt === 'string' ? n.updatedAt : now,
  }
}

function migrateLink(raw: unknown): ApplicationLink | null {
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Record<string, unknown>
  return {
    id: typeof n.id === 'string' ? n.id : uid(),
    label: typeof n.label === 'string' ? n.label : '',
    url: typeof n.url === 'string' ? n.url : '',
  }
}

function migrateStatusEvent(raw: unknown): ApplicationStatusEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const n = raw as Record<string, unknown>
  if (!isStatus(n.status) || typeof n.at !== 'string') return null
  return {
    id: typeof n.id === 'string' ? n.id : uid(),
    status: n.status,
    at: n.at,
  }
}

function isComposeStep(v: unknown): v is ApplicationComposeStep {
  return typeof v === 'string' && (APPLICATION_COMPOSE_STEPS as readonly string[]).includes(v)
}

export function migrateApplications(raw: unknown): Application[] {
  if (!Array.isArray(raw)) return []
  const out: Application[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const a = item as Record<string, unknown>
    if (typeof a.id !== 'string') continue
    const company = typeof a.company === 'string' ? a.company : ''
    const jobDoc = normalizeAppsJobDoc(a.jobDoc) ?? { text: '', annotations: [] }
    const notes = Array.isArray(a.notes)
      ? a.notes.map(migrateNote).filter((n): n is ApplicationNote => !!n)
      : []
    const links = Array.isArray(a.links)
      ? a.links.map(migrateLink).filter((l): l is ApplicationLink => !!l)
      : []
    const now = new Date().toISOString()
    const hasIdentity = Boolean(company.trim() || (typeof a.role === 'string' && a.role.trim()))
    const hasJd = Boolean(jobDoc.text.trim() || jobDoc.annotations.length)
    const inferredStep: ApplicationComposeStep = (() => {
      if (a.composeStep === 'extras') return 'notes'
      if (isComposeStep(a.composeStep)) return a.composeStep
      if (hasIdentity && hasJd) return 'done'
      if (hasIdentity) return 'jd'
      return 'identity'
    })()
    const status = isStatus(a.status) ? a.status : 'not-submitted'
    const submittedAt =
      typeof a.submittedAt === 'string'
        ? a.submittedAt
        : status !== 'not-submitted' && status !== 'not-pursuing'
          ? typeof a.updatedAt === 'string'
            ? a.updatedAt
            : typeof a.createdAt === 'string'
              ? a.createdAt
              : now
          : null
    const createdAt = typeof a.createdAt === 'string' ? a.createdAt : now
    let statusLog = Array.isArray(a.statusLog)
      ? a.statusLog.map(migrateStatusEvent).filter((e): e is ApplicationStatusEvent => !!e)
      : []
    if (!statusLog.length && status !== 'not-submitted') {
      statusLog = [
        {
          id: uid(),
          status,
          at: submittedAt ?? createdAt,
        },
      ]
    }
    out.push({
      id: a.id,
      role: typeof a.role === 'string' ? a.role : '',
      company,
      companyKey:
        typeof a.companyKey === 'string' && a.companyKey
          ? a.companyKey
          : normalizeCompanyKey(company),
      jobDoc,
      status,
      statusLog,
      notes,
      links,
      fitOverlap: typeof a.fitOverlap === 'string' ? a.fitOverlap : '',
      fitGaps: typeof a.fitGaps === 'string' ? a.fitGaps : '',
      fitTrajectory: typeof a.fitTrajectory === 'string' ? a.fitTrajectory : '',
      composeStep: inferredStep,
      submittedAt,
      createdAt,
      updatedAt: typeof a.updatedAt === 'string' ? a.updatedAt : now,
    })
  }
  return out
}

/** Lift a legacy session-only JD into a bank application when migrating. */
export function applicationFromLegacyJobDoc(jobDoc: AppsJobDoc, prompt?: string): Application {
  const role = prompt?.trim() && prompt !== 'Apply Yourself' ? prompt.trim() : ''
  return newApplicationDraft({
    role,
    jobDoc: normalizeAppsJobDoc(jobDoc) ?? jobDoc,
    composeStep: 'done',
  })
}

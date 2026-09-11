export const CATEGORIES = ['applications', 'communication', 'dsa'] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABEL: Record<Category, string> = {
  applications: 'Applications',
  communication: 'Communication',
  dsa: 'Data Structures and Algorithms',
}

export const CATEGORY_BLURB: Record<Category, string> = {
  applications: 'Track roles and companies. Mark up postings, status, and prep notes.',
  communication: 'Say it out loud. Draft, deliver, or go cold.',
  dsa: 'Reps under the clock. Problems stay on your tracker.',
}

export type Story = {
  id: string
  title: string
  notes: string
  createdAt: string
  updatedAt: string
}

/** Groups Communication prompts (e.g. Behavioral, a resume project). Not the apps/comm/dsa track. */
export type PromptCategory = {
  id: string
  title: string
  description: string
  /** Built-in starter categories (e.g. Behavioral) cannot be deleted. */
  builtin: boolean
  createdAt: string
  updatedAt: string
}

export const BEHAVIORAL_CATEGORY_ID = 'pcat-behavioral'

export type Question = {
  id: string
  prompt: string
  custom: boolean
  categoryId: string
}

export type SessionKind =
  | 'comm-draft'
  | 'comm-deliver'
  | 'comm-cold'
  | 'apps-block'
  | 'dsa-block'
  | 'interview-drill'
  | 'cold-burst'
  | 'story-retrieval'
  | 'quick-drill'

export const COMM_KINDS: SessionKind[] = ['comm-draft', 'comm-deliver', 'comm-cold']

export const CATEGORY_BY_KIND: Record<SessionKind, Category> = {
  'comm-draft': 'communication',
  'comm-deliver': 'communication',
  'comm-cold': 'communication',
  'apps-block': 'applications',
  'dsa-block': 'dsa',
  'interview-drill': 'communication',
  'cold-burst': 'communication',
  'story-retrieval': 'communication',
  'quick-drill': 'communication',
}

/**
 * Concurrent live sessions: apps/dsa stay one-per-category.
 * Communication allows one live session per kind (draft + rapid fire can both run).
 */
export function liveSlotKey(kind: SessionKind): string {
  const cat = CATEGORY_BY_KIND[kind]
  if (cat !== 'communication') return `cat:${cat}`
  return `kind:${kind}`
}

export function sameLiveSlot(a: SessionKind, b: SessionKind): boolean {
  return liveSlotKey(a) === liveSlotKey(b)
}

export type PhaseKind = 'draft' | 'deliver' | 'think' | 'speak' | 'block'

export type PlannedPhase = {
  id: string
  kind: PhaseKind
  durationSec: number
  questionId: string
  storyId?: string
  prompt: string
  notes?: string
}

export type MediaKind = 'audio' | 'video'

export type SessionAnswer = {
  questionId: string
  prompt: string
  storyId?: string
  draftNotes: string
  transcript: string
  audioId?: string
  /** Set when a take was recorded; older sessions may omit (treat as audio). */
  mediaKind?: MediaKind
}

export type DsaRetrievedItem = {
  /** Stable id for UI edits during a session. */
  id?: string
  problem: string
  difficulty: string
  topics: string
  notes: string
  /** Tracker this row was logged to / retrieved from. */
  sheetId?: string
  sheetName?: string
  /** Whether the user marked this problem as completed in the session. */
  solved?: boolean
  /** Time spent on this problem while solving the current session (seconds). */
  timeSec?: number
}

/** Comment anchored to a span of a pasted job description (character offsets). */
export type JdAnnotation = {
  id: string
  start: number
  end: number
  /** Snapshot of the selected text — used to re-anchor if the JD is edited. */
  quote: string
  body: string
  createdAt: string
}

/** Job posting workspace for an Applications block. */
export type AppsJobDoc = {
  text: string
  annotations: JdAnnotation[]
}

export function emptyAppsJobDoc(): AppsJobDoc {
  return { text: '', annotations: [] }
}

export const APPLICATION_STATUSES = [
  'not-submitted',
  'submitted',
  'interviewing',
  'received-offer',
  'rejected',
  'ghosted',
  'not-pursuing',
] as const

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  'not-submitted': 'Not Submitted',
  submitted: 'Submitted',
  interviewing: 'Interviewing',
  'received-offer': 'Received Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
  'not-pursuing': 'Not Pursuing',
}

export type ApplicationNote = {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
}

export type ApplicationLink = {
  id: string
  label: string
  url: string
}

export type ApplicationStatusEvent = {
  id: string
  status: ApplicationStatus
  /** When this status was set. */
  at: string
}

/** Saved job application — bank record, editable from Applications sessions. */
export type Application = {
  id: string
  role: string
  company: string
  /** Normalized company key for future querying (lowercase, collapsed space). */
  companyKey: string
  jobDoc: AppsJobDoc
  status: ApplicationStatus
  /** Chronological log of status changes (oldest → newest). */
  statusLog: ApplicationStatusEvent[]
  notes: ApplicationNote[]
  links: ApplicationLink[]
  /** Fit: overlap between experience and what they need. */
  fitOverlap: string
  /** Fit: meaningful gaps. */
  fitGaps: string
  /** Fit: why this is a good career moment and what trajectory it could give. */
  fitTrajectory: string
  /**
   * Guided create flow position. `done` means the application is persisted in the bank
   * (auto once role + company are set); view navigation uses local step state after that.
   */
  composeStep: ApplicationComposeStep
  /** When the application left Not Submitted; null if still unsubmitted. */
  submittedAt: string | null
  createdAt: string
  updatedAt: string
}

export const APPLICATION_COMPOSE_STEPS = [
  'identity',
  'jd',
  'fit',
  'links',
  'notes',
  'status',
  'done',
] as const

export type ApplicationComposeStep = (typeof APPLICATION_COMPOSE_STEPS)[number]

export function emptyApplicationNote(): Omit<ApplicationNote, 'id' | 'createdAt' | 'updatedAt'> {
  return { title: '', body: '' }
}

export function emptyApplicationLink(): Omit<ApplicationLink, 'id'> {
  return { label: '', url: '' }
}

export function emptyApplication(): Omit<Application, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    role: '',
    company: '',
    companyKey: '',
    jobDoc: emptyAppsJobDoc(),
    status: 'not-submitted',
    statusLog: [],
    notes: [],
    links: [],
    fitOverlap: '',
    fitGaps: '',
    fitTrajectory: '',
    composeStep: 'identity',
    submittedAt: null,
  }
}

export function normalizeCompanyKey(company: string): string {
  return company.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function applicationLabel(app: Pick<Application, 'role' | 'company'>): string {
  const role = app.role.trim()
  const company = app.company.trim()
  if (role && company) return `${role} · ${company}`
  if (role) return role
  if (company) return company
  return 'Untitled application'
}

export type Reflection = {
  wentWell: string
  couldImprove: string
  additionalNotes: string
  /** Freeform takeaways (DSA / communication, and legacy apps). */
  note?: string
  /** Apps reflection: what got done this session. */
  gotDone?: string
  /** Apps reflection: what should be done next. */
  doNext?: string
}

export type PracticeSession = {
  id: string
  kind: SessionKind
  startedAt: string
  completedAt?: string
  phases: PlannedPhase[]
  answers: SessionAnswer[]
  dsaRetrieved?: DsaRetrievedItem[]
  /**
   * Applications opened in this apps-block (ids into AppState.applications).
   * Prefer this over legacy `appsJobDoc`.
   */
  appsApplicationIds?: string[]
  /** Which open application is focused in the studio. */
  appsActiveId?: string | null
  /** @deprecated Legacy single JD workspace — migrated into the applications bank when possible. */
  appsJobDoc?: AppsJobDoc
  reflection?: Reflection
  categoryMinutes: Partial<Record<Category, number>>
  inProgress: boolean
  currentPhaseIndex: number
  /** Wall-clock start of the current phase (ISO). Used to compute elapsed time. */
  phaseStartedAt?: string
  /** When paused, elapsed seconds frozen here instead of wall clock. */
  phasePausedElapsedSec?: number
}

export type DailyGoals = Record<Category, number>

export type MaxStreaks = Record<Category, number>

export const DURATION_KINDS = [
  'comm-draft',
  'comm-deliver',
  'comm-cold',
  'apps-block',
  'dsa-block',
] as const

export type DurationKind = (typeof DURATION_KINDS)[number]

export type SessionDurations = Record<DurationKind, number>

export type SheetLink = {
  url: string
  importedAt?: string
}

export type NamedSheet = {
  id: string
  name: string
  url: string
  importedAt?: string
}

export type AppState = {
  stories: Story[]
  /** Saved job applications (role, company, JD markup, status, notes, links). */
  applications: Application[]
  /** Prompt banks under Communication (Behavioral starter + user-created). */
  promptCategories: PromptCategory[]
  customQuestions: Question[]
  /** Seed prompt ids the user removed from the bank. */
  removedQuestionIds: string[]
  /** Prompt category ids included when starting Communication drills. */
  drillPromptCategoryIds: string[]
  sessions: PracticeSession[]
  goals: DailyGoals
  maxStreaks: MaxStreaks
  durations: SessionDurations
  sheets: { applications: SheetLink; dsa: NamedSheet[] }
  activeSessionId: string | null
}

export const DEFAULT_GOALS: DailyGoals = {
  applications: 30,
  communication: 40,
  dsa: 45,
}

export const DEFAULT_MAX_STREAKS: MaxStreaks = {
  applications: 0,
  communication: 0,
  dsa: 0,
}

export const DEFAULT_DURATIONS: SessionDurations = {
  'comm-draft': 15,
  'comm-deliver': 10,
  'comm-cold': 20,
  'apps-block': 25,
  'dsa-block': 45,
}

export const DEFAULT_SHEETS: AppState['sheets'] = {
  applications: { url: '' },
  dsa: [{ id: 'dsa-1', name: 'Tracker 1', url: '' }],
}

export function clampMinutes(n: number, fallback: number): number {
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(180, Math.round(n))
}

export function durationFor(durations: SessionDurations, kind: SessionKind): number {
  if ((DURATION_KINDS as readonly string[]).includes(kind)) {
    return durations[kind as DurationKind]
  }
  return SESSION_META[kind].minutes
}

export const SESSION_META: Record<
  SessionKind,
  { title: string; minutes: number; blurb: string }
> = {
  'comm-draft': {
    title: 'Draft the answer',
    minutes: 15,
    blurb: 'Write it, then deliver on camera. One question, two beats.',
  },
  'comm-deliver': {
    title: 'Talk from the draft',
    minutes: 10,
    blurb: 'Same question. Draft hidden. Record your delivery.',
  },
  'comm-cold': {
    title: 'Rapid Fire',
    minutes: 20,
    blurb: 'Unexpected prompts. Speak under the clock.',
  },
  'apps-block': {
    title: 'Apply Yourself',
    minutes: 25,
    blurb: 'Work one or more applications — mark up postings, track status, and prep notes.',
  },
  'dsa-block': {
    title: 'Problem Solve',
    minutes: 45,
    blurb: 'Pick problems. Solve under the clock.',
  },
  'interview-drill': {
    title: 'Interview drill (legacy)',
    minutes: 50,
    blurb: 'Older combined loop.',
  },
  'cold-burst': {
    title: 'Rapid Fire (legacy)',
    minutes: 20,
    blurb: 'Older combined loop.',
  },
  'story-retrieval': {
    title: 'Story retrieval (legacy)',
    minutes: 15,
    blurb: 'Older combined loop.',
  },
  'quick-drill': {
    title: 'Quick drill (legacy)',
    minutes: 15,
    blurb: 'Older combined loop.',
  },
}

export function emptyStory(): Omit<Story, 'id' | 'createdAt' | 'updatedAt'> {
  return { title: '', notes: '' }
}

export function emptyReflection(): Reflection {
  return {
    wentWell: '',
    couldImprove: '',
    additionalNotes: '',
    note: '',
    gotDone: '',
    doNext: '',
  }
}

function reflectionField(raw: unknown): string {
  return typeof raw === 'string' ? raw : ''
}

/** Single string for history / glance lines. */
export function reflectionSummary(r: Reflection | undefined): string {
  if (!r) return ''
  const gotDone = r.gotDone?.trim() ?? ''
  const doNext = r.doNext?.trim() ?? ''
  if (gotDone || doNext) {
    return [gotDone && `Done: ${gotDone}`, doNext && `Next: ${doNext}`].filter(Boolean).join(' · ')
  }
  const note = r.note?.trim() ?? ''
  if (note) return note
  const text = [r.wentWell, r.couldImprove, r.additionalNotes]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' · ')
  return text
}

export function normalizeReflection(raw: unknown): Reflection | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const wentWell = reflectionField(r.wentWell)
  const couldImprove = reflectionField(r.couldImprove)
  const additionalNotes = reflectionField(r.additionalNotes)
  const note = reflectionField(r.note)
  const gotDone = reflectionField(r.gotDone)
  const doNext = reflectionField(r.doNext)
  const merged = {
    wentWell,
    couldImprove,
    additionalNotes,
    ...(note ? { note } : {}),
    ...(gotDone ? { gotDone } : {}),
    ...(doNext ? { doNext } : {}),
  }
  if (wentWell || couldImprove || additionalNotes || note || gotDone || doNext) {
    return merged
  }
  const parts = ['stuck', 'ramble', 'explainedWell', 'knowledgeGap', 'practiceAgain']
    .map((k) => r[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  if (!parts.length) return undefined
  return { wentWell: '', couldImprove: '', additionalNotes: parts.join('\n'), note: parts.join('\n') }
}

export function reflectionHasContent(r?: Reflection): boolean {
  if (!r) return false
  return Boolean(
    r.wentWell.trim() ||
      r.couldImprove.trim() ||
      r.additionalNotes.trim() ||
      r.note?.trim() ||
      r.gotDone?.trim() ||
      r.doNext?.trim(),
  )
}

export function reflectionSnippet(r?: Reflection, max = 80): string {
  if (!r) return ''
  const text = [
    r.note,
    r.gotDone,
    r.doNext,
    r.wentWell,
    r.couldImprove,
    r.additionalNotes,
  ]
    .map((s) => s?.trim() ?? '')
    .filter(Boolean)
    .join(' · ')
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

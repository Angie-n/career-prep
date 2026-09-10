export const CATEGORIES = ['applications', 'communication', 'dsa'] as const

export type Category = (typeof CATEGORIES)[number]

export const CATEGORY_LABEL: Record<Category, string> = {
  applications: 'Applications',
  communication: 'Communication',
  dsa: 'Data Structures and Algorithms',
}

export const CATEGORY_BLURB: Record<Category, string> = {
  applications: 'Hunt and apply. Pure clock time — no drills mixed in.',
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

export type SessionAnswer = {
  questionId: string
  prompt: string
  storyId?: string
  draftNotes: string
  transcript: string
  audioId?: string
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

export type Reflection = {
  note: string
}

export type PracticeSession = {
  id: string
  kind: SessionKind
  startedAt: string
  completedAt?: string
  phases: PlannedPhase[]
  answers: SessionAnswer[]
  dsaRetrieved?: DsaRetrievedItem[]
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
    blurb: "One question. Write what you'd actually say.",
  },
  'comm-deliver': {
    title: 'Talk from the draft',
    minutes: 10,
    blurb: 'Same question. Draft hidden. Speak it.',
  },
  'comm-cold': {
    title: 'Rapid Fire',
    minutes: 20,
    blurb: 'Unexpected prompts. Speak under the clock.',
  },
  'apps-block': {
    title: 'Apply Yourself',
    minutes: 25,
    blurb: 'Look, apply, follow up.',
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
  return { note: '' }
}

export function normalizeReflection(raw: unknown): Reflection | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (typeof r.note === 'string') return { note: r.note }
  const parts = ['stuck', 'ramble', 'explainedWell', 'knowledgeGap', 'practiceAgain']
    .map((k) => r[k])
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
  if (!parts.length) return undefined
  return { note: parts.join('\n') }
}

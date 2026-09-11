import { uid } from './ids'
import { SEED_QUESTIONS } from './seedQuestions'
import type {
  Category,
  PlannedPhase,
  PracticeSession,
  DsaRetrievedItem,
  Question,
  SessionAnswer,
  SessionKind,
} from './types'
import { CATEGORY_BY_KIND, COMM_KINDS, SESSION_META } from './types'

export function allQuestions(
  custom: Question[],
  removedIds: string[] = [],
): Question[] {
  const removed = new Set(removedIds)
  const overlay = new Map(custom.map((q) => [q.id, q]))
  const seeds = SEED_QUESTIONS.filter((q) => !removed.has(q.id)).map(
    (q) => overlay.get(q.id) ?? q,
  )
  const extras = custom.filter(
    (q) => !SEED_QUESTIONS.some((s) => s.id === q.id) && !removed.has(q.id),
  )
  return [...seeds, ...extras]
}

export function questionsForCategory(
  categoryId: string,
  custom: Question[],
  removedIds: string[] = [],
): Question[] {
  return allQuestions(custom, removedIds).filter((q) => q.categoryId === categoryId)
}

export function questionsForCategories(
  categoryIds: string[] | undefined,
  custom: Question[],
  removedIds: string[] = [],
): Question[] {
  const all = allQuestions(custom, removedIds)
  if (!categoryIds || categoryIds.length === 0) return all
  const allowed = new Set(categoryIds)
  return all.filter((q) => allowed.has(q.categoryId))
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const a = next[i]
    const b = next[j]
    if (a === undefined || b === undefined) continue
    next[i] = b
    next[j] = a
  }
  return next
}

function pick(pool: Question[], count: number): Question[] {
  return shuffle(pool).slice(0, Math.min(count, pool.length))
}

function finish(
  kind: SessionKind,
  phases: PlannedPhase[],
  extraAnswers: SessionAnswer[] = [],
  dsaRetrieved?: DsaRetrievedItem[],
): PracticeSession {
  const answers: SessionAnswer[] = [...extraAnswers]
  const seen = new Set(answers.map((a) => a.questionId + (a.storyId ?? '')))
  for (const p of phases) {
    const key = (p.questionId ?? '') + (p.storyId ?? '')
    if (!p.questionId || seen.has(key)) continue
    seen.add(key)
    answers.push({
      questionId: p.questionId,
      prompt: p.prompt,
      storyId: p.storyId,
      draftNotes: '',
      transcript: '',
    })
  }
  const now = new Date().toISOString()
  return {
    id: uid(),
    kind,
    startedAt: now,
    phases,
    answers,
    dsaRetrieved,
    categoryMinutes: {},
    inProgress: true,
    currentPhaseIndex: 0,
    phaseStartedAt: now,
  }
}

/** Elapsed seconds for the active phase, from wall clock or pause freeze. */
export function phaseElapsedSec(session: PracticeSession, nowMs = Date.now()): number {
  if (typeof session.phasePausedElapsedSec === 'number') {
    return Math.max(0, Math.floor(session.phasePausedElapsedSec))
  }
  const startedMs = session.phaseStartedAt ? Date.parse(session.phaseStartedAt) : nowMs
  return Math.max(0, Math.floor((nowMs - startedMs) / 1000))
}

export function isPhasePaused(session: PracticeSession): boolean {
  return typeof session.phasePausedElapsedSec === 'number'
}

/** Elapsed seconds for an in-progress session (prior phases + current phase clock). */
export function sessionElapsedSec(session: PracticeSession, nowMs = Date.now()): number {
  let sec = 0
  for (let i = 0; i < session.currentPhaseIndex; i++) {
    sec += session.phases[i]?.durationSec ?? 0
  }
  sec += phaseElapsedSec(session, nowMs)
  return Math.max(0, sec)
}

export function previousDrafts(sessions: PracticeSession[]): SessionAnswer[] {
  const out: SessionAnswer[] = []
  for (const s of sessions) {
    if (!COMM_KINDS.includes(s.kind)) continue
    if (!s.completedAt) continue
    for (const a of s.answers) {
      if (a.draftNotes.trim()) out.push(a)
    }
  }
  return out
}

export function buildSession(
  kind: SessionKind,
  customQuestions: Question[],
  opts?: {
    draft?: SessionAnswer
    minutes?: number
    /** Speak phase length when Draft includes Talk-from-draft (2/2). */
    deliverMinutes?: number
    note?: string
    dsaRetrieved?: DsaRetrievedItem[]
    removedQuestionIds?: string[]
    promptCategoryIds?: string[]
  },
): PracticeSession {
  const pool = questionsForCategories(
    opts?.promptCategoryIds,
    customQuestions,
    opts?.removedQuestionIds,
  )
  const phases: PlannedPhase[] = []

  const add = (kindPhase: PlannedPhase['kind'], sec: number, q: Question) => {
    phases.push({
      id: uid(),
      kind: kindPhase,
      durationSec: sec,
      questionId: q.id,
      prompt: q.prompt,
    })
  }

  if (kind === 'comm-draft') {
    const main = pick(pool, 1)[0]
    if (main) {
      add('draft', (opts?.minutes ?? 15) * 60, main)
      add('deliver', (opts?.deliverMinutes ?? 10) * 60, main)
    }
  }

  if (kind === 'comm-deliver') {
    const draft = opts?.draft
    const deliverSec = (opts?.minutes ?? 10) * 60
    if (draft) {
      phases.push({
        id: uid(),
        kind: 'deliver',
        durationSec: deliverSec,
        questionId: draft.questionId,
        storyId: draft.storyId,
        prompt: draft.prompt,
      })
      return finish(kind, phases, [
        {
          ...draft,
          transcript: '',
          audioId: undefined,
          mediaKind: undefined,
        },
      ])
    }
    const main = pick(pool, 1)[0]
    if (main) add('deliver', deliverSec, main)
  }

  if (kind === 'comm-cold' || kind === 'cold-burst') {
    const cold = pick(pool, 5)
    const totalSec = (opts?.minutes ?? 20) * 60
    const n = Math.max(1, cold.length)
    const speak = Math.max(45, Math.round(totalSec / n))
    for (const q of cold) {
      add('speak', speak, q)
    }
  }

  if (kind === 'apps-block' || kind === 'dsa-block') {
    const minutes = opts?.minutes ?? (kind === 'dsa-block' ? 45 : 25)
    phases.push({
      id: uid(),
      kind: 'block',
      durationSec: minutes * 60,
      questionId: kind,
      prompt: opts?.note?.trim() || SESSION_META[kind].title,
    })
  }

  return finish(kind, phases, [], opts?.dsaRetrieved)
}

export function minutesByCategory(session: PracticeSession, completedAt: string): Partial<Record<Category, number>> {
  const cat = CATEGORY_BY_KIND[session.kind]
  const elapsed = (Date.parse(completedAt) - Date.parse(session.startedAt)) / 60000
  const mins = Math.max(1, Math.round(elapsed))
  return { [cat]: mins }
}

/** Live studio + wrap-up UI. Category homes stay idle; resume CTAs land here. */
export const ACTIVE_SESSION_PATH = '/active'

export function activeSessionPath(sessionId: string): string {
  return `${ACTIVE_SESSION_PATH}/${sessionId}`
}

export function startHref(kind: SessionKind): string {
  if (kind === 'apps-block') return '/applications'
  if (kind === 'dsa-block') return '/dsa'
  return '/practice'
}

export function homeForCategory(category: Category): string {
  if (category === 'applications') return '/applications'
  if (category === 'dsa') return '/dsa'
  return '/practice'
}

export function homeForKind(kind: SessionKind): string {
  return homeForCategory(CATEGORY_BY_KIND[kind])
}

export function historyForCategory(category: Category): string {
  if (category === 'applications') return '/applications/history'
  if (category === 'dsa') return '/dsa/history'
  return '/practice/history'
}

export function historyForKind(kind: SessionKind): string {
  return historyForCategory(CATEGORY_BY_KIND[kind])
}

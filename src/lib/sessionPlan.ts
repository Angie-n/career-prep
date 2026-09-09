import { uid } from './ids'
import { SEED_QUESTIONS } from './seedQuestions'
import type {
  Category,
  PlannedPhase,
  PracticeSession,
  Question,
  SessionAnswer,
  SessionKind,
} from './types'
import { CATEGORY_BY_KIND } from './types'

export function allQuestions(custom: Question[]): Question[] {
  const overlay = new Map(custom.map((q) => [q.id, q]))
  const seeds = SEED_QUESTIONS.map((q) => overlay.get(q.id) ?? q)
  const extras = custom.filter((q) => !SEED_QUESTIONS.some((s) => s.id === q.id))
  return [...seeds, ...extras]
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
  return {
    id: uid(),
    kind,
    startedAt: new Date().toISOString(),
    phases,
    answers,
    categoryMinutes: {},
    inProgress: true,
    currentPhaseIndex: 0,
  }
}

export function previousDrafts(sessions: PracticeSession[]): SessionAnswer[] {
  const out: SessionAnswer[] = []
  for (const s of sessions) {
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
  opts?: { draft?: SessionAnswer; minutes?: number; note?: string },
): PracticeSession {
  const pool = allQuestions(customQuestions)
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
    if (main) add('draft', (opts?.minutes ?? 15) * 60, main)
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
    const think = 40
    const speak = Math.max(45, Math.round(totalSec / n - think))
    for (const q of cold) {
      add('think', think, q)
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
      prompt: opts?.note?.trim() || (kind === 'apps-block' ? 'Application block' : 'DSA block'),
    })
  }

  return finish(kind, phases)
}

export function minutesByCategory(session: PracticeSession, completedAt: string): Partial<Record<Category, number>> {
  const cat = CATEGORY_BY_KIND[session.kind]
  const elapsed = (Date.parse(completedAt) - Date.parse(session.startedAt)) / 60000
  const planned = session.phases.reduce((n, p) => n + p.durationSec / 60, 0)
  const mins = Math.max(1, Math.round(Math.min(elapsed, planned + 2)))
  return { [cat]: mins }
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

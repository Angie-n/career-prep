import { todayKey } from './ids'
import { sessionElapsedSec } from './sessionPlan'
import type { AppState, Category, DailyGoals, PracticeSession, SessionAnswer } from './types'
import { CATEGORIES, CATEGORY_BY_KIND, CATEGORY_LABEL, COMM_KINDS, reflectionSummary } from './types'

export function completedSessions(state: AppState): PracticeSession[] {
  return state.sessions.filter((s) => s.completedAt && !s.inProgress)
}

export function sessionsOn(state: AppState, day: string): PracticeSession[] {
  return completedSessions(state).filter((s) => todayKey(new Date(s.completedAt!)) === day)
}

/** Local midnight → next midnight for a YYYY-MM-DD key. */
function localDayBoundsMs(day: string): { start: number; end: number } | null {
  const parts = day.split('-').map(Number)
  const y = parts[0]
  const m = parts[1]
  const d = parts[2]
  if (!y || !m || !d) return null
  const start = new Date(y, m - 1, d).getTime()
  const end = new Date(y, m - 1, d + 1).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null
  return { start, end }
}

function overlapMinutes(rangeStart: number, rangeEnd: number, day: string): number {
  const bounds = localDayBoundsMs(day)
  if (!bounds) return 0
  const a = Math.max(rangeStart, bounds.start)
  const b = Math.min(rangeEnd, bounds.end)
  return Math.max(0, (b - a) / 60000)
}

/** Effective [start, end] for crediting session time onto calendar days. */
function sessionCreditRangeMs(
  session: PracticeSession,
  nowMs = Date.now(),
): { start: number; end: number } | null {
  const start = Date.parse(session.startedAt)
  if (!Number.isFinite(start)) return null
  if (session.inProgress) {
    // Use elapsed clock (respects pause) rather than wall time to now.
    return { start, end: start + sessionElapsedSec(session, nowMs) * 1000 }
  }
  if (!session.completedAt) return null
  const end = Date.parse(session.completedAt)
  if (!Number.isFinite(end)) return null
  return { start, end: Math.max(start, end) }
}

/**
 * Minutes per category credited to a calendar day.
 * Splits session time across the local days it actually covered (including
 * in-progress sessions), so yesterday’s streak cell fills when you worked then.
 */
export function minutesToday(
  state: AppState,
  day = todayKey(),
  nowMs = Date.now(),
): Record<Category, number> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  for (const s of state.sessions) {
    const range = sessionCreditRangeMs(s, nowMs)
    if (!range) continue
    const cat = CATEGORY_BY_KIND[s.kind]
    out[cat] += overlapMinutes(range.start, range.end, day)
  }
  return out
}

/** Credited minutes toward goals ÷ total goal minutes (per-category overtime does not count). Max 100%. */
export function todayGoalProgressPct(
  mins: Record<Category, number>,
  goals: DailyGoals,
): number {
  const credited = CATEGORIES.reduce((n, c) => n + Math.min(mins[c], goals[c]), 0)
  const totalGoal = CATEGORIES.reduce((n, c) => n + goals[c], 0)
  if (totalGoal <= 0) return 0
  return (credited / totalGoal) * 100
}

export function minutesLastDays(state: AppState, days: number): Record<Category, number> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  const start = new Date()
  start.setDate(start.getDate() - (days - 1))
  const startKey = todayKey(start)
  for (const s of completedSessions(state)) {
    const day = todayKey(new Date(s.completedAt!))
    if (day < startKey) continue
    for (const c of CATEGORIES) out[c] += s.categoryMinutes[c] ?? 0
  }
  return out
}

/** All credited minutes per category, including live in-progress session time. */
export function minutesAllTime(
  state: AppState,
  nowMs = Date.now(),
): Record<Category, number> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  for (const s of completedSessions(state)) {
    for (const c of CATEGORIES) out[c] += s.categoryMinutes[c] ?? 0
  }
  for (const s of state.sessions) {
    if (!s.inProgress) continue
    const cat = CATEGORY_BY_KIND[s.kind]
    out[cat] += sessionElapsedSec(s, nowMs) / 60
  }
  return out
}

export function formatTotalMinutes(mins: number): string {
  const m = Math.max(0, Math.round(mins))
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}m` : `${h}h`
}

export function lastNDays(n: number): string[] {
  const days: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(todayKey(d))
  }
  return days
}

export function goalMetOn(state: AppState, category: Category, day: string): boolean {
  return minutesToday(state, day)[category] >= state.goals[category]
}

/** Consecutive days meeting the category goal, ending today (or yesterday if today not yet met). */
export function categoryStreak(state: AppState, category: Category): number {
  let n = 0
  const cursor = new Date()
  if (!goalMetOn(state, category, todayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  while (goalMetOn(state, category, todayKey(cursor))) {
    n += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

export function categoryStreaks(state: AppState): Record<Category, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, categoryStreak(state, c)])) as Record<
    Category,
    number
  >
}

export function withUpdatedMaxStreaks(state: AppState): AppState['maxStreaks'] {
  const next = { ...state.maxStreaks }
  for (const c of CATEGORIES) {
    next[c] = Math.max(next[c] ?? 0, categoryStreak(state, c))
  }
  return next
}

/** Last `days` calendar days (oldest → newest) and whether the category goal was met. */
export function goalMetWindow(
  state: AppState,
  category: Category,
  days = 28,
): { day: string; met: boolean }[] {
  return lastNDays(days).map((day) => ({ day, met: goalMetOn(state, category, day) }))
}

export function sessionsForCategory(state: AppState, category: Category): PracticeSession[] {
  return completedSessions(state)
    .filter((s) => CATEGORY_BY_KIND[s.kind] === category)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
}

export function neglectedCategories(state: AppState): Category[] {
  const last7 = minutesLastDays(state, 7)
  const target = CATEGORIES.map((c) => ({
    c,
    ratio: last7[c] / Math.max(1, state.goals[c] * 7),
  }))
  return target.sort((a, b) => a.ratio - b.ratio).map((x) => x.c)
}

export function recentReflections(state: AppState, limit = 4) {
  return completedSessions(state)
    .filter((s) => reflectionSummary(s.reflection))
    .slice()
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, limit)
}

export function improvingNote(state: AppState): string {
  const done = completedSessions(state)
  if (done.length < 2) return 'A few sessions will be enough to see what keeps coming up.'
  const last = done.slice(-4)
  const notes = last.map((s) => reflectionSummary(s.reflection)).filter(Boolean)
  if (notes.length) return 'Your notes are the practice list — not a score.'
  const minutes = minutesLastDays(state, 7)
  const total = CATEGORIES.reduce((n, c) => n + minutes[c], 0)
  if (total === 0) return 'Consistency beats intensity. Start the shortest session that you will actually finish.'
  const weak = neglectedCategories(state)[0]
  if (!weak) return 'Pick a clock and start.'
  return `You have been showing up. The thin spot is ${CATEGORY_LABEL[weak]}.`
}

/** Normalize sheet Date cells to YYYY-MM-DD (local). */
export function sheetDateKey(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const t = Date.parse(v)
  if (Number.isNaN(t)) return null
  return todayKey(new Date(t))
}

export function countSheetRowsOnDay(
  rows: { Date?: string; date?: string }[],
  day: string,
): number {
  let n = 0
  for (const row of rows) {
    const key = sheetDateKey(row.Date ?? row.date ?? '')
    if (key === day) n += 1
  }
  return n
}

export function countSheetRows(rows: unknown[]): number {
  return rows.length
}

function isPromptAnswered(a: SessionAnswer): boolean {
  return Boolean(a.draftNotes.trim() || a.transcript.trim() || a.audioId)
}

function sessionTouchesDay(session: PracticeSession, day: string): boolean {
  if (session.completedAt) return todayKey(new Date(session.completedAt)) === day
  if (session.inProgress) return todayKey(new Date(session.startedAt)) === day
  return false
}

/** Draft/deliver/cold answers with content, for sessions that touch the day. */
export function promptsAnsweredOn(state: AppState, day = todayKey()): number {
  let n = 0
  for (const s of state.sessions) {
    if (!COMM_KINDS.includes(s.kind)) continue
    if (!sessionTouchesDay(s, day)) continue
    n += s.answers.filter(isPromptAnswered).length
  }
  return n
}

/** All-time prompts answered across communication sessions (incl. in progress). */
export function promptsAnsweredAllTime(state: AppState): number {
  let n = 0
  for (const s of state.sessions) {
    if (!COMM_KINDS.includes(s.kind)) continue
    n += s.answers.filter(isPromptAnswered).length
  }
  return n
}

/**
 * DSA problems attributed to the day from tracker rows pulled into sessions
 * that touch the day (same sense as the in-session solved count).
 */
export function dsaProblemsSolvedOn(state: AppState, day = todayKey()): number {
  let n = 0
  for (const s of state.sessions) {
    if (s.kind !== 'dsa-block') continue
    if (!sessionTouchesDay(s, day)) continue
    n += s.dsaRetrieved?.length ?? 0
  }
  return n
}

/** All-time DSA problems from tracker rows pulled into sessions. */
export function dsaProblemsSolvedAllTime(state: AppState): number {
  let n = 0
  const seen = new Set<string>()
  for (const s of state.sessions) {
    if (s.kind !== 'dsa-block') continue
    for (const item of s.dsaRetrieved ?? []) {
      const key = item.problem.trim().toLowerCase()
      if (!key || seen.has(key)) continue
      seen.add(key)
      n += 1
    }
  }
  return n
}

/** Applications that were actually submitted (have a submit date). */
export function applicationsSubmittedAllTime(state: AppState): number {
  return state.applications.filter((a) => !!a.submittedAt).length
}

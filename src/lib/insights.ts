import { todayKey } from './ids'
import { sessionElapsedSec } from './sessionPlan'
import type { AppState, Category, DailyGoals, PracticeSession } from './types'
import { CATEGORIES, CATEGORY_BY_KIND, CATEGORY_LABEL } from './types'

export function completedSessions(state: AppState): PracticeSession[] {
  return state.sessions.filter((s) => s.completedAt && !s.inProgress)
}

export function sessionsOn(state: AppState, day: string): PracticeSession[] {
  return completedSessions(state).filter((s) => todayKey(new Date(s.completedAt!)) === day)
}

export function minutesToday(
  state: AppState,
  day = todayKey(),
  nowMs = Date.now(),
): Record<Category, number> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>
  for (const s of sessionsOn(state, day)) {
    for (const c of CATEGORIES) {
      out[c] += s.categoryMinutes[c] ?? 0
    }
  }
  // Live sessions count toward today only; discarding them drops this credit.
  if (day === todayKey(new Date(nowMs))) {
    for (const s of state.sessions) {
      if (!s.inProgress) continue
      const cat = CATEGORY_BY_KIND[s.kind]
      out[cat] += sessionElapsedSec(s, nowMs) / 60
    }
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
    .filter((s) => s.reflection?.note.trim())
    .slice()
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
    .slice(0, limit)
}

export function improvingNote(state: AppState): string {
  const done = completedSessions(state)
  if (done.length < 2) return 'A few sessions will be enough to see what keeps coming up.'
  const last = done.slice(-4)
  const notes = last.map((s) => s.reflection?.note.trim()).filter(Boolean)
  if (notes.length) return 'Your notes are the practice list — not a score.'
  const minutes = minutesLastDays(state, 7)
  const total = CATEGORIES.reduce((n, c) => n + minutes[c], 0)
  if (total === 0) return 'Consistency beats intensity. Start the shortest session that you will actually finish.'
  const weak = neglectedCategories(state)[0]
  if (!weak) return 'Pick a clock and start.'
  return `You have been showing up. The thin spot is ${CATEGORY_LABEL[weak]}.`
}

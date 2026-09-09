import { createContext, createElement, useContext, useMemo, useReducer, useEffect, type ReactNode } from 'react'
import { uid } from '../lib/ids'
import { withUpdatedMaxStreaks } from '../lib/insights'
import { minutesByCategory } from '../lib/sessionPlan'
import { loadState, saveState } from '../lib/storage'
import type { AppState, Category, MaxStreaks, PracticeSession, Question, Reflection, Story } from '../lib/types'
import { CATEGORY_BY_KIND, emptyStory } from '../lib/types'

type Action =
  | { type: 'upsert-story'; story: Story }
  | { type: 'delete-story'; id: string }
  | { type: 'upsert-question'; question: Question }
  | { type: 'delete-question'; id: string }
  | { type: 'set-goals'; goals: AppState['goals'] }
  | { type: 'set-max-streaks'; maxStreaks: MaxStreaks }
  | { type: 'sync-max-streaks' }
  | { type: 'set-durations'; durations: AppState['durations'] }
  | { type: 'set-sheets'; sheets: AppState['sheets'] }
  | { type: 'start-session'; session: PracticeSession }
  | { type: 'focus-session'; id: string }
  | { type: 'patch-session'; session: PracticeSession }
  | { type: 'complete-session'; id: string; reflection?: Reflection }
  | { type: 'abandon-session'; id: string }
  | { type: 'delete-session'; id: string }
  | { type: 'clear-history' }

/** In-progress sessions, one per category, most recently started first. */
export function inProgressSessions(state: AppState): PracticeSession[] {
  const seen = new Set<Category>()
  const out: PracticeSession[] = []
  for (const s of state.sessions
    .filter((s) => s.inProgress)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))) {
    const cat = CATEGORY_BY_KIND[s.kind]
    if (seen.has(cat)) continue
    seen.add(cat)
    out.push(s)
  }
  return out
}

export function inProgressForCategory(
  state: AppState,
  category: Category,
): PracticeSession | undefined {
  return inProgressSessions(state).find((s) => CATEGORY_BY_KIND[s.kind] === category)
}

function nextActiveId(sessions: PracticeSession[], preferId?: string | null): string | null {
  const live = sessions.filter((s) => s.inProgress)
  if (preferId && live.some((s) => s.id === preferId)) return preferId
  return live[0]?.id ?? null
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'upsert-story': {
      const exists = state.stories.some((s) => s.id === action.story.id)
      return {
        ...state,
        stories: exists
          ? state.stories.map((s) => (s.id === action.story.id ? action.story : s))
          : [action.story, ...state.stories],
      }
    }
    case 'delete-story':
      return { ...state, stories: state.stories.filter((s) => s.id !== action.id) }
    case 'upsert-question': {
      const exists = state.customQuestions.some((q) => q.id === action.question.id)
      return {
        ...state,
        customQuestions: exists
          ? state.customQuestions.map((q) => (q.id === action.question.id ? action.question : q))
          : [...state.customQuestions, action.question],
      }
    }
    case 'delete-question':
      return {
        ...state,
        customQuestions: state.customQuestions.filter((q) => q.id !== action.id),
      }
    case 'set-goals': {
      const next = { ...state, goals: action.goals }
      return { ...next, maxStreaks: withUpdatedMaxStreaks(next) }
    }
    case 'set-max-streaks':
      return { ...state, maxStreaks: action.maxStreaks }
    case 'sync-max-streaks': {
      const maxStreaks = withUpdatedMaxStreaks(state)
      if (
        maxStreaks.applications === state.maxStreaks.applications &&
        maxStreaks.communication === state.maxStreaks.communication &&
        maxStreaks.dsa === state.maxStreaks.dsa
      ) {
        return state
      }
      return { ...state, maxStreaks }
    }
    case 'set-durations':
      return { ...state, durations: action.durations }
    case 'set-sheets':
      return { ...state, sheets: action.sheets }
    case 'start-session': {
      const cat = CATEGORY_BY_KIND[action.session.kind]
      const conflict = state.sessions.find(
        (s) =>
          s.inProgress &&
          s.id !== action.session.id &&
          CATEGORY_BY_KIND[s.kind] === cat,
      )
      // One in-progress session per category — keep the live one unless this is the same id.
      if (conflict) return state
      return {
        ...state,
        sessions: [action.session, ...state.sessions.filter((s) => s.id !== action.session.id)],
        activeSessionId: action.session.id,
      }
    }
    case 'focus-session': {
      const live = state.sessions.find((s) => s.id === action.id && s.inProgress)
      if (!live) return state
      if (state.activeSessionId === action.id) return state
      return { ...state, activeSessionId: action.id }
    }
    case 'patch-session':
      return {
        ...state,
        sessions: state.sessions.map((s) => (s.id === action.session.id ? action.session : s)),
      }
    case 'complete-session': {
      const session = state.sessions.find((s) => s.id === action.id)
      if (!session) return { ...state, activeSessionId: nextActiveId(state.sessions) }
      const completedAt = new Date().toISOString()
      const completed: PracticeSession = {
        ...session,
        inProgress: false,
        completedAt,
        reflection: action.reflection,
        categoryMinutes: minutesByCategory(session, completedAt),
      }
      const sessions = state.sessions.map((s) => (s.id === action.id ? completed : s))
      const next: AppState = {
        ...state,
        sessions,
        activeSessionId: nextActiveId(sessions),
      }
      return { ...next, maxStreaks: withUpdatedMaxStreaks(next) }
    }
    case 'abandon-session': {
      const target = state.sessions.find((s) => s.id === action.id)
      if (!target) return state
      const cat = CATEGORY_BY_KIND[target.kind]
      // Drop the discarded session and any same-category in-progress duplicates
      // (legacy / multi-start glitches) so Resume lists clear immediately.
      const sessions = state.sessions.filter((s) => {
        if (s.id === action.id) return false
        if (s.inProgress && CATEGORY_BY_KIND[s.kind] === cat) return false
        return true
      })
      const prefer =
        state.activeSessionId && sessions.some((s) => s.id === state.activeSessionId && s.inProgress)
          ? state.activeSessionId
          : null
      return {
        ...state,
        sessions,
        activeSessionId: nextActiveId(sessions, prefer),
      }
    }
    case 'delete-session': {
      const sessions = state.sessions.filter((s) => s.id !== action.id)
      return {
        ...state,
        sessions,
        activeSessionId: nextActiveId(sessions, state.activeSessionId === action.id ? null : state.activeSessionId),
      }
    }
    case 'clear-history': {
      const live = state.sessions.filter((s) => s.inProgress)
      return {
        ...state,
        sessions: live,
        activeSessionId: nextActiveId(live, state.activeSessionId),
      }
    }
    default:
      return state
  }
}

const StoreContext = createContext<{
  state: AppState
  dispatch: (a: Action) => void
} | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const value = useMemo(() => ({ state, dispatch }), [state])
  return createElement(StoreContext.Provider, { value }, children)
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('Store missing')
  return ctx
}

/** Focused in-progress session (`activeSessionId`), if still live. */
export function useActiveSession() {
  const { state } = useStore()
  return state.sessions.find((s) => s.id === state.activeSessionId && s.inProgress)
}

export function useInProgressSessions() {
  const { state } = useStore()
  return useMemo(() => inProgressSessions(state), [state])
}

export function useInProgressForCategory(category: Category) {
  const { state } = useStore()
  return useMemo(() => inProgressForCategory(state, category), [state, category])
}

export function newStoryDraft(): Story {
  const now = new Date().toISOString()
  return { ...emptyStory(), id: uid(), createdAt: now, updatedAt: now }
}

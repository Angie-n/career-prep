import { createContext, createElement, useContext, useMemo, useReducer, useEffect, type ReactNode } from 'react'
import { uid } from '../lib/ids'
import { withUpdatedMaxStreaks } from '../lib/insights'
import { minutesByCategory } from '../lib/sessionPlan'
import { loadState, saveState } from '../lib/storage'
import type { AppState, MaxStreaks, PracticeSession, Question, Reflection, Story } from '../lib/types'
import { emptyStory } from '../lib/types'

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
  | { type: 'patch-session'; session: PracticeSession }
  | { type: 'complete-session'; id: string; reflection?: Reflection }
  | { type: 'abandon-session' }
  | { type: 'delete-session'; id: string }
  | { type: 'clear-history' }

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
    case 'start-session':
      return {
        ...state,
        sessions: [action.session, ...state.sessions.filter((s) => s.id !== action.session.id)],
        activeSessionId: action.session.id,
      }
    case 'patch-session':
      return {
        ...state,
        sessions: state.sessions.map((s) => (s.id === action.session.id ? action.session : s)),
      }
    case 'complete-session': {
      const session = state.sessions.find((s) => s.id === action.id)
      if (!session) return { ...state, activeSessionId: null }
      const completedAt = new Date().toISOString()
      const completed: PracticeSession = {
        ...session,
        inProgress: false,
        completedAt,
        reflection: action.reflection,
        categoryMinutes: minutesByCategory(session, completedAt),
      }
      const next: AppState = {
        ...state,
        sessions: state.sessions.map((s) => (s.id === action.id ? completed : s)),
        activeSessionId: null,
      }
      return { ...next, maxStreaks: withUpdatedMaxStreaks(next) }
    }
    case 'abandon-session':
      return {
        ...state,
        activeSessionId: null,
        sessions: state.sessions.map((s) =>
          s.id === state.activeSessionId ? { ...s, inProgress: false } : s,
        ),
      }
    case 'delete-session': {
      const keepActive = state.activeSessionId !== action.id
      return {
        ...state,
        sessions: state.sessions.filter((s) => s.id !== action.id),
        activeSessionId: keepActive ? state.activeSessionId : null,
      }
    }
    case 'clear-history': {
      const live = state.sessions.find((s) => s.id === state.activeSessionId && s.inProgress)
      return {
        ...state,
        sessions: live ? [live] : [],
        activeSessionId: live ? live.id : null,
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

export function useActiveSession() {
  const { state } = useStore()
  return state.sessions.find((s) => s.id === state.activeSessionId && s.inProgress)
}

export function newStoryDraft(): Story {
  const now = new Date().toISOString()
  return { ...emptyStory(), id: uid(), createdAt: now, updatedAt: now }
}

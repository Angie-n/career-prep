import { createContext, createElement, useContext, useMemo, useReducer, useEffect, useRef, type ReactNode } from 'react'
import {
  beginRemoteHydrate,
  bumpLocalUpdatedAt,
  clearLocalUpdatedAt,
  endRemoteHydrate,
  reconcileOnSignIn,
  resetSyncStatus,
  schedulePush,
} from '../lib/cloudSync'
import { isAppSignedIn, subscribeAppAuth } from '../lib/appAuth'
import { uid } from '../lib/ids'
import { withUpdatedMaxStreaks } from '../lib/insights'
import { SEED_QUESTIONS } from '../lib/seedQuestions'
import { minutesByCategory } from '../lib/sessionPlan'
import { clearLocalDeviceCaches, emptyAppState, loadState, saveState } from '../lib/storage'
import { clearEnteredWorkspace } from '../lib/workspaceEntry'
import { BEHAVIORAL_CATEGORY_ID, CATEGORY_BY_KIND, emptyStory, liveSlotKey, sameLiveSlot } from '../lib/types'
import type {
  AppState,
  Application,
  Category,
  MaxStreaks,
  PracticeSession,
  PromptCategory,
  Question,
  Reflection,
  SessionKind,
  Story,
} from '../lib/types'
import { newApplicationDraft } from '../lib/applications'

type Action =
  | { type: 'replace-state'; state: AppState }
  | { type: 'upsert-story'; story: Story }
  | { type: 'delete-story'; id: string }
  | { type: 'upsert-application'; application: Application }
  | { type: 'delete-application'; id: string }
  | { type: 'upsert-prompt-category'; category: PromptCategory }
  | { type: 'delete-prompt-category'; id: string }
  | { type: 'upsert-question'; question: Question }
  | { type: 'delete-question'; id: string }
  | { type: 'set-goals'; goals: AppState['goals'] }
  | { type: 'set-max-streaks'; maxStreaks: MaxStreaks }
  | { type: 'sync-max-streaks' }
  | { type: 'set-durations'; durations: AppState['durations'] }
  | { type: 'set-drill-prompt-categories'; ids: string[] }
  | { type: 'set-sheets'; sheets: AppState['sheets'] }
  | { type: 'start-session'; session: PracticeSession }
  | { type: 'focus-session'; id: string }
  | { type: 'patch-session'; session: PracticeSession }
  | { type: 'complete-session'; id: string; reflection?: Reflection }
  | { type: 'abandon-session'; id: string }
  | { type: 'delete-session'; id: string }
  | { type: 'clear-history' }

/** In-progress sessions, one per live slot, most recently started first. */
export function inProgressSessions(state: AppState): PracticeSession[] {
  const seen = new Set<string>()
  const out: PracticeSession[] = []
  for (const s of state.sessions
    .filter((s) => s.inProgress)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))) {
    const key = liveSlotKey(s.kind)
    if (seen.has(key)) continue
    seen.add(key)
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

export function inProgressSessionsForCategory(
  state: AppState,
  category: Category,
): PracticeSession[] {
  return inProgressSessions(state).filter((s) => CATEGORY_BY_KIND[s.kind] === category)
}

export function inProgressForKind(
  state: AppState,
  kind: SessionKind,
): PracticeSession | undefined {
  return inProgressSessions(state).find((s) => sameLiveSlot(s.kind, kind))
}

function nextActiveId(sessions: PracticeSession[], preferId?: string | null): string | null {
  const live = sessions.filter((s) => s.inProgress)
  if (preferId && live.some((s) => s.id === preferId)) return preferId
  return live[0]?.id ?? null
}

function isSeedQuestion(id: string): boolean {
  return SEED_QUESTIONS.some((q) => q.id === id)
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'replace-state':
      return action.state
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
    case 'upsert-application': {
      const exists = state.applications.some((a) => a.id === action.application.id)
      return {
        ...state,
        applications: exists
          ? state.applications.map((a) =>
              a.id === action.application.id ? action.application : a,
            )
          : [action.application, ...state.applications],
      }
    }
    case 'delete-application':
      return {
        ...state,
        applications: state.applications.filter((a) => a.id !== action.id),
        sessions: state.sessions.map((s) => {
          if (!s.appsApplicationIds?.includes(action.id)) return s
          const appsApplicationIds = s.appsApplicationIds.filter((id) => id !== action.id)
          const appsActiveId =
            s.appsActiveId === action.id ? appsApplicationIds[0] ?? null : s.appsActiveId
          return { ...s, appsApplicationIds, appsActiveId }
        }),
      }
    case 'upsert-prompt-category': {
      const exists = state.promptCategories.some((c) => c.id === action.category.id)
      return {
        ...state,
        promptCategories: exists
          ? state.promptCategories.map((c) =>
              c.id === action.category.id
                ? {
                    ...action.category,
                    builtin: c.builtin || action.category.id === BEHAVIORAL_CATEGORY_ID,
                  }
                : c,
            )
          : [action.category, ...state.promptCategories],
      }
    }
    case 'delete-prompt-category': {
      const target = state.promptCategories.find((c) => c.id === action.id)
      if (!target || target.builtin || target.id === BEHAVIORAL_CATEGORY_ID) return state
      const nextIds = state.drillPromptCategoryIds.filter((id) => id !== action.id)
      return {
        ...state,
        promptCategories: state.promptCategories.filter((c) => c.id !== action.id),
        customQuestions: state.customQuestions.map((q) =>
          q.categoryId === action.id ? { ...q, categoryId: BEHAVIORAL_CATEGORY_ID } : q,
        ),
        drillPromptCategoryIds: nextIds.length
          ? nextIds
          : state.promptCategories.filter((c) => c.id !== action.id).map((c) => c.id),
      }
    }
    case 'upsert-question': {
      const exists = state.customQuestions.some((q) => q.id === action.question.id)
      const removedQuestionIds = state.removedQuestionIds.filter((id) => id !== action.question.id)
      return {
        ...state,
        removedQuestionIds,
        customQuestions: exists
          ? state.customQuestions.map((q) => (q.id === action.question.id ? action.question : q))
          : [...state.customQuestions, action.question],
      }
    }
    case 'delete-question': {
      const customQuestions = state.customQuestions.filter((q) => q.id !== action.id)
      const removedQuestionIds =
        isSeedQuestion(action.id) && !state.removedQuestionIds.includes(action.id)
          ? [...state.removedQuestionIds, action.id]
          : state.removedQuestionIds
      return { ...state, customQuestions, removedQuestionIds }
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
    case 'set-drill-prompt-categories': {
      const valid = new Set(state.promptCategories.map((c) => c.id))
      return {
        ...state,
        drillPromptCategoryIds: action.ids.filter((id) => valid.has(id)),
      }
    }
    case 'set-sheets':
      return { ...state, sheets: action.sheets }
    case 'start-session': {
      const conflict = state.sessions.find(
        (s) =>
          s.inProgress &&
          s.id !== action.session.id &&
          sameLiveSlot(s.kind, action.session.kind),
      )
      // One in-progress session per live slot.
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
      // Drop this session and any same-slot in-progress duplicates.
      const sessions = state.sessions.filter((s) => {
        if (s.id === action.id) return false
        if (s.inProgress && sameLiveSlot(s.kind, target.kind)) return false
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
        activeSessionId: nextActiveId(
          sessions,
          state.activeSessionId === action.id ? null : state.activeSessionId,
        ),
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
  const stateRef = useRef(state)
  const skipNextPushRef = useRef(false)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    saveState(state)
    if (skipNextPushRef.current) {
      skipNextPushRef.current = false
      endRemoteHydrate()
      return
    }
    // Advance local clock on edit so Case B4 does not hydrate over unpushed work.
    bumpLocalUpdatedAt()
    schedulePush(state)
  }, [state])

  useEffect(() => {
    let cancelled = false

    const runReconcile = async () => {
      if (!isAppSignedIn()) {
        resetSyncStatus()
        return
      }
      try {
        const remote = await reconcileOnSignIn(stateRef.current)
        if (cancelled || !remote) return
        beginRemoteHydrate()
        skipNextPushRef.current = true
        dispatch({ type: 'replace-state', state: remote })
      } catch {
        /* status already set in cloudSync */
      }
    }

    void runReconcile()
    return subscribeAppAuth(() => {
      if (!isAppSignedIn()) {
        // Wipe local studio so signed-out UI is empty; do not push empty doc to D1.
        beginRemoteHydrate()
        skipNextPushRef.current = true
        clearLocalUpdatedAt()
        clearEnteredWorkspace()
        resetSyncStatus()
        dispatch({ type: 'replace-state', state: emptyAppState() })
        void clearLocalDeviceCaches().catch(() => {
          /* best-effort */
        })
        return
      }
      void runReconcile()
    })
  }, [])

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

export function useInProgressSessionsForCategory(category: Category) {
  const { state } = useStore()
  return useMemo(() => inProgressSessionsForCategory(state, category), [state, category])
}

export function useInProgressForKind(kind: SessionKind) {
  const { state } = useStore()
  return useMemo(() => inProgressForKind(state, kind), [state, kind])
}

export function newStoryDraft(): Story {
  const now = new Date().toISOString()
  return { ...emptyStory(), id: uid(), createdAt: now, updatedAt: now }
}

export { newApplicationDraft }

export function newPromptCategoryDraft(): PromptCategory {
  const now = new Date().toISOString()
  return {
    id: uid(),
    title: '',
    description: '',
    builtin: false,
    createdAt: now,
    updatedAt: now,
  }
}

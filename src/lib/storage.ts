import {
  BEHAVIORAL_CATEGORY_ID,
  DEFAULT_DURATIONS,
  DEFAULT_GOALS,
  DEFAULT_MAX_STREAKS,
  clampMinutes,
  liveSlotKey,
  normalizeReflection,
  type AppState,
  type DailyGoals,
  type MaxStreaks,
  type PracticeSession,
  type PromptCategory,
  type Question,
  type SessionDurations,
  type Story,
} from './types'
import { withUpdatedMaxStreaks } from './insights'
import { normalizeAppsJobDoc } from './jdAnnotations'
import { applicationFromLegacyJobDoc, migrateApplications } from './applications'
import { SEED_BEHAVIORAL_CATEGORY } from './seedQuestions'
import { minutesByCategory } from './sessionPlan'

const KEY = 'studio:v1'
const DB_NAME = 'studio-audio'
const STORE = 'blobs'

function migrateGoals(raw: Partial<DailyGoals> | undefined): DailyGoals {
  return {
    applications: Number(raw?.applications) || DEFAULT_GOALS.applications,
    communication: Number(raw?.communication) || DEFAULT_GOALS.communication,
  }
}

function migrateMaxStreaks(raw: Partial<MaxStreaks> | undefined): MaxStreaks {
  return {
    applications: Math.max(0, Math.floor(Number(raw?.applications) || 0)),
    communication: Math.max(0, Math.floor(Number(raw?.communication) || 0)),
  }
}

function migrateDurations(raw: Partial<SessionDurations> | undefined): SessionDurations {
  return {
    'comm-draft': clampMinutes(Number(raw?.['comm-draft']), DEFAULT_DURATIONS['comm-draft']),
    'comm-deliver': clampMinutes(Number(raw?.['comm-deliver']), DEFAULT_DURATIONS['comm-deliver']),
    'comm-cold': clampMinutes(Number(raw?.['comm-cold']), DEFAULT_DURATIONS['comm-cold']),
    'apps-block': clampMinutes(Number(raw?.['apps-block']), DEFAULT_DURATIONS['apps-block']),
  }
}

function migratePromptCategories(raw: unknown): PromptCategory[] {
  const now = new Date().toISOString()
  const list: PromptCategory[] = []
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const c = item as Partial<PromptCategory>
      const id = String(c.id || '')
      if (!id) continue
      list.push({
        id,
        title: String(c.title || 'Untitled').trim() || 'Untitled',
        description: String(c.description || '').trim(),
        builtin: Boolean(c.builtin) || id === BEHAVIORAL_CATEGORY_ID,
        createdAt: String(c.createdAt || now),
        updatedAt: String(c.updatedAt || c.createdAt || now),
      })
    }
  }
  if (!list.some((c) => c.id === BEHAVIORAL_CATEGORY_ID)) {
    list.unshift({ ...SEED_BEHAVIORAL_CATEGORY })
  } else {
    const i = list.findIndex((c) => c.id === BEHAVIORAL_CATEGORY_ID)
    const existing = list[i]
    if (existing) {
      const next = { ...existing, builtin: true }
      // Drop old “Starter kit” wording from the seeded description if untouched.
      if (
        next.description.includes('Starter kit') &&
        next.description.startsWith('Classic')
      ) {
        next.description = SEED_BEHAVIORAL_CATEGORY.description
      }
      list[i] = next
    }
  }
  return list
}

function migrateQuestions(raw: unknown, categoryIds: Set<string>): Question[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const q = item as Partial<Question> & { prompt?: string }
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) return []
    const id = String(q.id || '')
    if (!id) return []
    let categoryId = String(q.categoryId || BEHAVIORAL_CATEGORY_ID)
    if (!categoryIds.has(categoryId)) categoryId = BEHAVIORAL_CATEGORY_ID
    return [
      {
        id,
        prompt: q.prompt.trim(),
        custom: true,
        categoryId,
      },
    ]
  })
}

function migrateRemovedQuestionIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((id) => String(id)).filter(Boolean)
}

function migrateDrillPromptCategoryIds(raw: unknown, categoryIds: string[]): string[] {
  const valid = new Set(categoryIds)
  if (!Array.isArray(raw) || raw.length === 0) return [...categoryIds]
  const picked = raw.map((id) => String(id)).filter((id) => valid.has(id))
  return picked.length ? picked : [...categoryIds]
}

function migrateStories(raw: unknown): Story[] {
  if (!Array.isArray(raw)) return []
  return raw
    .flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const s = item as Record<string, unknown>
      const notes =
        typeof s.notes === 'string' && s.notes.trim()
          ? s.notes
          : [
              s.situation,
              s.noticed,
              s.constraints,
              s.options,
              s.decision,
              s.implementation,
              s.result,
              s.learned,
            ]
              .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
              .join('\n\n')
      return [
        {
          id: String(s.id || ''),
          title: String(s.title || 'Untitled'),
          notes,
          createdAt: String(s.createdAt || new Date().toISOString()),
          updatedAt: String(s.updatedAt || s.createdAt || new Date().toISOString()),
        },
      ]
    })
    .filter((s) => s.id)
}

function emptyState(): AppState {
  const promptCategories = [{ ...SEED_BEHAVIORAL_CATEGORY }]
  return {
    stories: [],
    applications: [],
    promptCategories,
    customQuestions: [],
    removedQuestionIds: [],
    drillPromptCategoryIds: promptCategories.map((c) => c.id),
    sessions: [],
    goals: { ...DEFAULT_GOALS },
    maxStreaks: { ...DEFAULT_MAX_STREAKS },
    durations: { ...DEFAULT_DURATIONS },
    activeSessionId: null,
  }
}

/** Fresh studio document (defaults only). Used after sign-out wipe. */
export function emptyAppState(): AppState {
  return emptyState()
}

/** Keep the newest in-progress session per live slot; drop older duplicates. */
export function dedupeInProgressSessions(sessions: PracticeSession[]): PracticeSession[] {
  const keep = new Set<string>()
  const seen = new Set<string>()
  const live = sessions
    .filter((s) => s.inProgress)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
  for (const s of live) {
    const key = liveSlotKey(s.kind)
    if (seen.has(key)) continue
    seen.add(key)
    keep.add(s.id)
  }
  return sessions.filter((s) => {
    if (!s.inProgress) return true
    return keep.has(s.id)
  })
}

/** Run the same migrators used for localStorage on any AppState-shaped JSON (e.g. D1). */
export function normalizeState(input: unknown): AppState {
  if (!input || typeof input !== 'object') return emptyState()
  const parsed = input as AppState & { removedQuestionIds?: unknown }
  const applications = migrateApplications((parsed as AppState).applications)
  const migratedSessions = (parsed.sessions ?? []).map((s) => {
    const rawS = s as typeof s & {
      phasePausedRemainingSec?: number
      phasePausedElapsedSec?: number
      appsJobDoc?: unknown
      appsApplicationIds?: unknown
      appsActiveId?: unknown
    }
    const session = {
      ...rawS,
      reflection: normalizeReflection(rawS.reflection),
      appsJobDoc: normalizeAppsJobDoc(rawS.appsJobDoc) ?? rawS.appsJobDoc,
      appsApplicationIds: Array.isArray(rawS.appsApplicationIds)
        ? rawS.appsApplicationIds.filter((id): id is string => typeof id === 'string')
        : undefined,
      appsActiveId:
        typeof rawS.appsActiveId === 'string' || rawS.appsActiveId === null
          ? rawS.appsActiveId
          : undefined,
    }
    if (
      typeof session.phasePausedRemainingSec === 'number' &&
      session.phasePausedElapsedSec == null
    ) {
      const phase = session.phases?.[session.currentPhaseIndex]
      const remaining = session.phasePausedRemainingSec
      const duration = phase?.durationSec ?? remaining
      session.phasePausedElapsedSec = Math.max(0, Math.floor(duration - remaining))
    }
    delete session.phasePausedRemainingSec
    if (session.inProgress && !session.phaseStartedAt && session.phasePausedElapsedSec == null) {
      // Prefer session start so a refresh doesn't wipe elapsed time back to zero.
      session.phaseStartedAt =
        typeof session.startedAt === 'string' && session.startedAt
          ? session.startedAt
          : new Date().toISOString()
    }

    if (
      !session.inProgress &&
      session.completedAt &&
      (!session.categoryMinutes ||
        Object.values(session.categoryMinutes).every((n) => !n || n <= 0))
    ) {
      session.categoryMinutes = minutesByCategory(session, session.completedAt)
    }

    // Lift legacy single JD into the applications bank when the session has no ids yet.
    if (
      session.kind === 'apps-block' &&
      (!session.appsApplicationIds || session.appsApplicationIds.length === 0) &&
      session.appsJobDoc &&
      (session.appsJobDoc.text.trim() || session.appsJobDoc.annotations.length)
    ) {
      const lifted = applicationFromLegacyJobDoc(
        session.appsJobDoc,
        session.phases?.[0]?.prompt,
      )
      applications.unshift(lifted)
      session.appsApplicationIds = [lifted.id]
      session.appsActiveId = lifted.id
      session.appsJobDoc = undefined
    }

    return session
  })
  const sessions = dedupeInProgressSessions(migratedSessions)
  let activeSessionId = parsed.activeSessionId ?? null
  if (activeSessionId && !sessions.some((s) => s.id === activeSessionId && s.inProgress)) {
    activeSessionId = sessions.find((s) => s.inProgress)?.id ?? null
  }
  const promptCategories = migratePromptCategories(parsed.promptCategories)
  const categoryIds = promptCategories.map((c) => c.id)
  const categoryIdSet = new Set(categoryIds)
  const base: AppState = {
    stories: migrateStories(parsed.stories),
    applications,
    promptCategories,
    customQuestions: migrateQuestions(parsed.customQuestions, categoryIdSet),
    removedQuestionIds: migrateRemovedQuestionIds(parsed.removedQuestionIds),
    drillPromptCategoryIds: migrateDrillPromptCategoryIds(
      (parsed as AppState).drillPromptCategoryIds,
      categoryIds,
    ),
    sessions,
    goals: migrateGoals(parsed.goals),
    maxStreaks: migrateMaxStreaks(parsed.maxStreaks),
    durations: migrateDurations(parsed.durations),
    activeSessionId,
  }
  return { ...base, maxStreaks: withUpdatedMaxStreaks(base) }
}

export function loadState(): AppState {
  const raw = localStorage.getItem(KEY)
  if (!raw) return emptyState()
  try {
    return normalizeState(JSON.parse(raw))
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState) {
  const slim: AppState = {
    ...state,
    sessions: state.sessions.map(stripHeavy),
  }
  localStorage.setItem(KEY, JSON.stringify(slim))
}

function stripHeavy(session: PracticeSession): PracticeSession {
  return session
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveAudio(id: string, blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(blob, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getAudio(id: string): Promise<Blob | undefined> {
  const db = await openDb()
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result as Blob | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return blob
}

export async function deleteAudio(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

function audioIdsFrom(session: PracticeSession): string[] {
  return session.answers.map((a) => a.audioId).filter((id): id is string => Boolean(id))
}

export async function deleteSessionMedia(session: PracticeSession): Promise<void> {
  await Promise.all(audioIdsFrom(session).map((id) => deleteAudio(id)))
}

export async function deleteSessionsMedia(sessions: PracticeSession[]): Promise<void> {
  await Promise.all(sessions.map((s) => deleteSessionMedia(s)))
}

/** Clear on-device media caches (audio). Does not touch D1. */
export async function clearLocalDeviceCaches(): Promise<void> {
  const clearStore = (open: () => Promise<IDBDatabase>, store: string) =>
    open().then(
      (db) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite')
          tx.objectStore(store).clear()
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onerror = () => {
            db.close()
            reject(tx.error)
          }
        }),
    )
  await clearStore(openDb, STORE)
}

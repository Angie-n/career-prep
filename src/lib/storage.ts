import {
  DEFAULT_DURATIONS,
  DEFAULT_GOALS,
  DEFAULT_MAX_STREAKS,
  DEFAULT_SHEETS,
  clampMinutes,
  normalizeReflection,
  type AppState,
  type DailyGoals,
  type MaxStreaks,
  type NamedSheet,
  type PracticeSession,
  type Question,
  type SessionDurations,
  type Story,
} from './types'
import { withUpdatedMaxStreaks } from './insights'

const KEY = 'studio:v1'
const DB_NAME = 'studio-audio'
const STORE = 'blobs'

function migrateGoals(raw: Partial<DailyGoals> | undefined): DailyGoals {
  return {
    applications: Number(raw?.applications) || DEFAULT_GOALS.applications,
    communication: Number(raw?.communication) || DEFAULT_GOALS.communication,
    dsa: Number(raw?.dsa) || DEFAULT_GOALS.dsa,
  }
}

function migrateMaxStreaks(raw: Partial<MaxStreaks> | undefined): MaxStreaks {
  return {
    applications: Math.max(0, Math.floor(Number(raw?.applications) || 0)),
    communication: Math.max(0, Math.floor(Number(raw?.communication) || 0)),
    dsa: Math.max(0, Math.floor(Number(raw?.dsa) || 0)),
  }
}

function migrateDurations(raw: Partial<SessionDurations> | undefined): SessionDurations {
  return {
    'comm-draft': clampMinutes(Number(raw?.['comm-draft']), DEFAULT_DURATIONS['comm-draft']),
    'comm-deliver': clampMinutes(Number(raw?.['comm-deliver']), DEFAULT_DURATIONS['comm-deliver']),
    'comm-cold': clampMinutes(Number(raw?.['comm-cold']), DEFAULT_DURATIONS['comm-cold']),
    'apps-block': clampMinutes(Number(raw?.['apps-block']), DEFAULT_DURATIONS['apps-block']),
    'dsa-block': clampMinutes(Number(raw?.['dsa-block']), DEFAULT_DURATIONS['dsa-block']),
  }
}

function migrateQuestions(raw: unknown): Question[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const q = item as Partial<Question> & { prompt?: string }
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) return []
    return [{ id: String(q.id || ''), prompt: q.prompt.trim(), custom: true }]
  }).filter((q) => q.id)
}

function migrateStories(raw: unknown): Story[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
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
  }).filter((s) => s.id)
}

function migrateDsaSheets(raw: unknown): NamedSheet[] {
  if (Array.isArray(raw)) {
    const list = raw.map((item, i) => {
      const s = item as Partial<NamedSheet>
      return {
        id: String(s.id || `dsa-${i + 1}`),
        name: String(s.name || `Tracker ${i + 1}`),
        url: String(s.url || ''),
        importedAt: s.importedAt,
      }
    })
    return list.length ? list : DEFAULT_SHEETS.dsa.map((s) => ({ ...s }))
  }
  if (raw && typeof raw === 'object' && 'url' in raw) {
    const url = String((raw as { url?: string }).url || '')
    return [{ id: 'dsa-1', name: 'Tracker 1', url }]
  }
  return DEFAULT_SHEETS.dsa.map((s) => ({ ...s }))
}

function emptyState(): AppState {
  return {
    stories: [],
    customQuestions: [],
    sessions: [],
    goals: { ...DEFAULT_GOALS },
    maxStreaks: { ...DEFAULT_MAX_STREAKS },
    durations: { ...DEFAULT_DURATIONS },
    sheets: {
      applications: { url: '' },
      dsa: DEFAULT_SHEETS.dsa.map((s) => ({ ...s })),
    },
    activeSessionId: null,
  }
}

export function loadState(): AppState {
  const raw = localStorage.getItem(KEY)
  if (!raw) return emptyState()
  try {
    const parsed = JSON.parse(raw) as AppState
    const base: AppState = {
      stories: migrateStories(parsed.stories),
      customQuestions: migrateQuestions(parsed.customQuestions),
      sessions: (parsed.sessions ?? []).map((s) => ({
        ...s,
        reflection: normalizeReflection(s.reflection),
      })),
      goals: migrateGoals(parsed.goals),
      maxStreaks: migrateMaxStreaks(parsed.maxStreaks),
      durations: migrateDurations(parsed.durations),
      sheets: {
        applications: {
          url: parsed.sheets?.applications?.url ?? '',
          importedAt: parsed.sheets?.applications?.importedAt,
        },
        dsa: migrateDsaSheets(parsed.sheets?.dsa),
      },
      activeSessionId: parsed.activeSessionId ?? null,
    }
    return { ...base, maxStreaks: withUpdatedMaxStreaks(base) }
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

const SHEET_DB = 'studio-sheet-csv'
const SHEET_STORE = 'csv'

function openSheetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SHEET_DB, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(SHEET_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveSheetCsv(id: string, csv: string): Promise<void> {
  const db = await openSheetDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SHEET_STORE, 'readwrite')
    tx.objectStore(SHEET_STORE).put(csv, id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function getSheetCsv(id: string): Promise<string | undefined> {
  const db = await openSheetDb()
  const csv = await new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction(SHEET_STORE, 'readonly')
    const req = tx.objectStore(SHEET_STORE).get(id)
    req.onsuccess = () => resolve(req.result as string | undefined)
    req.onerror = () => reject(req.error)
  })
  db.close()
  return csv
}

export async function deleteSheetCsv(id: string): Promise<void> {
  const db = await openSheetDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SHEET_STORE, 'readwrite')
    tx.objectStore(SHEET_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

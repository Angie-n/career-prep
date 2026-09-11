import { apiFetch, isAppSignedIn } from './appAuth'
import { normalizeState } from './storage'
import type { AppState } from './types'

const LOCAL_UPDATED_KEY = 'studio:sync-updated-at'
const PUSH_DEBOUNCE_MS = 1200

export type SyncStatus =
  | { kind: 'idle' }
  | { kind: 'syncing'; detail?: string }
  | { kind: 'synced'; at: string }
  | { kind: 'error'; message: string }

let status: SyncStatus = { kind: 'idle' }
const listeners = new Set<() => void>()
let pushTimer: ReturnType<typeof setTimeout> | null = null
let pushGeneration = 0
/** Skip push while applying a remote hydrate. */
let suppressPush = false

function notify() {
  for (const l of listeners) l()
}

function setStatus(next: SyncStatus) {
  status = next
  notify()
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function getLocalUpdatedAt(): string {
  return localStorage.getItem(LOCAL_UPDATED_KEY) || ''
}

export function bumpLocalUpdatedAt(iso = new Date().toISOString()): string {
  localStorage.setItem(LOCAL_UPDATED_KEY, iso)
  return iso
}

export function setLocalUpdatedAt(iso: string) {
  localStorage.setItem(LOCAL_UPDATED_KEY, iso)
}

export function clearLocalUpdatedAt() {
  localStorage.removeItem(LOCAL_UPDATED_KEY)
}

function statePayload(state: AppState): string {
  return JSON.stringify(state)
}

export async function fetchRemoteState(): Promise<{ state: AppState | null; updatedAt: string | null }> {
  const res = await apiFetch('/api/state', { method: 'GET' })
  const data = (await res.json()) as {
    state?: unknown
    updatedAt?: string | null
    error?: string
  }
  if (!res.ok) throw new Error(data.error || `Could not load cloud state (${res.status}).`)
  if (data.state == null) return { state: null, updatedAt: null }
  return {
    state: normalizeState(data.state),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
  }
}

export async function pushRemoteState(state: AppState, updatedAt: string): Promise<string> {
  const res = await apiFetch('/api/state', {
    method: 'PUT',
    body: JSON.stringify({ state: JSON.parse(statePayload(state)), updatedAt }),
  })
  const data = (await res.json()) as { ok?: boolean; updatedAt?: string; error?: string }
  if (!res.ok) throw new Error(data.error || `Could not save cloud state (${res.status}).`)
  return data.updatedAt || updatedAt
}

/**
 * On sign-in: pull remote; if remote is newer, return it for hydrate.
 * Otherwise push local. Returns remote state to apply, or null if local kept.
 */
export async function reconcileOnSignIn(local: AppState): Promise<AppState | null> {
  if (!isAppSignedIn()) return null
  setStatus({ kind: 'syncing', detail: 'Checking cloud…' })
  try {
    const remote = await fetchRemoteState()
    const localAt = getLocalUpdatedAt()
    const remoteAt = remote.updatedAt || ''

    if (remote.state && remoteAt && (!localAt || remoteAt > localAt)) {
      setLocalUpdatedAt(remoteAt)
      setStatus({ kind: 'synced', at: remoteAt })
      return remote.state
    }

    const updatedAt = getLocalUpdatedAt() || bumpLocalUpdatedAt()
    const savedAt = await pushRemoteState(local, updatedAt)
    setLocalUpdatedAt(savedAt)
    setStatus({ kind: 'synced', at: savedAt })
    return null
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed.'
    setStatus({ kind: 'error', message })
    throw e
  }
}

export function schedulePush(state: AppState) {
  if (!isAppSignedIn() || suppressPush) return
  if (pushTimer) clearTimeout(pushTimer)
  const gen = ++pushGeneration
  pushTimer = setTimeout(() => {
    void (async () => {
      if (gen !== pushGeneration || !isAppSignedIn() || suppressPush) return
      setStatus({ kind: 'syncing', detail: 'Saving…' })
      try {
        const updatedAt = getLocalUpdatedAt() || bumpLocalUpdatedAt()
        const savedAt = await pushRemoteState(state, updatedAt)
        if (gen !== pushGeneration) return
        setLocalUpdatedAt(savedAt)
        setStatus({ kind: 'synced', at: savedAt })
      } catch (e) {
        if (gen !== pushGeneration) return
        setStatus({
          kind: 'error',
          message: e instanceof Error ? e.message : 'Could not save to cloud.',
        })
      }
    })()
  }, PUSH_DEBOUNCE_MS)
}

export function beginRemoteHydrate() {
  suppressPush = true
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  pushGeneration += 1
}

export function endRemoteHydrate() {
  suppressPush = false
}

export function resetSyncStatus() {
  if (pushTimer) {
    clearTimeout(pushTimer)
    pushTimer = null
  }
  pushGeneration += 1
  setStatus({ kind: 'idle' })
}

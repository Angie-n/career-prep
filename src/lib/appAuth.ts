/** App identity (Google ID token) — separate from Sheets access-token flow in googleAuth.ts */

const CLIENT_KEY = 'studio:google-client-id'
const SCRIPT = 'https://accounts.google.com/gsi/client'
const ID_TOKEN_KEY = 'studio:google-id-token'

type CredentialResponse = { credential?: string; error?: string }

type IdApi = {
  initialize: (cfg: {
    client_id: string
    callback: (resp: CredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  prompt: (momentListener?: (n: { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean }) => void) => void
  disableAutoSelect: () => void
}

let idToken: string | null =
  typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ID_TOKEN_KEY) : null
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export function subscribeAppAuth(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function appGoogleClientId(): string {
  return localStorage.getItem(CLIENT_KEY)?.trim() || String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
}

export function appIdToken(): string | null {
  return idToken
}

export function isAppSignedIn(): boolean {
  return Boolean(idToken)
}

async function loadIdApi(): Promise<IdApi> {
  const existing = window.google?.accounts?.id as IdApi | undefined
  if (existing) return existing
  await new Promise<void>((resolve, reject) => {
    const prior = document.querySelector(`script[src="${SCRIPT}"]`)
    if (prior) {
      prior.addEventListener('load', () => resolve())
      prior.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')))
      return
    }
    const el = document.createElement('script')
    el.src = SCRIPT
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => reject(new Error('Could not load Google sign-in.'))
    document.head.appendChild(el)
  })
  const id = window.google?.accounts?.id as IdApi | undefined
  if (!id) throw new Error('Google sign-in failed to load.')
  return id
}

export async function signInApp(): Promise<string> {
  const cid = appGoogleClientId()
  if (!cid) {
    throw new Error('Google sign-in isn’t configured. Set VITE_GOOGLE_CLIENT_ID in .env.local.')
  }
  const id = await loadIdApi()
  return new Promise((resolve, reject) => {
    id.initialize({
      client_id: cid,
      callback: (resp) => {
        if (!resp.credential) {
          reject(new Error(resp.error || 'Google sign-in was cancelled.'))
          return
        }
        idToken = resp.credential
        sessionStorage.setItem(ID_TOKEN_KEY, idToken)
        notify()
        resolve(idToken)
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    })
    id.prompt((notification) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
        reject(new Error('Google sign-in was dismissed. Try again, or allow prompts for this site.'))
      }
    })
  })
}

export function signOutApp() {
  idToken = null
  sessionStorage.removeItem(ID_TOKEN_KEY)
  try {
    const id = window.google?.accounts?.id as IdApi | undefined
    id?.disableAutoSelect()
  } catch {
    /* ignore */
  }
  notify()
}

export type ApiUser = {
  id: string
  email: string | null
  name: string | null
  picture: string | null
}

/** Call Worker API with the current Google ID token. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = appIdToken()
  if (!token) throw new Error('Not signed in.')
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return fetch(path, { ...init, headers })
}

export async function fetchMe(): Promise<ApiUser> {
  const res = await apiFetch('/api/me', { method: 'POST' })
  const data = (await res.json()) as { user?: ApiUser; error?: string }
  if (!res.ok || !data.user) {
    throw new Error(data.error || `Signed-in check failed (${res.status}).`)
  }
  return data.user
}

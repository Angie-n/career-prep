/** App identity (Google ID token) — separate from Sheets access-token flow in googleAuth.ts */

const CLIENT_KEY = 'studio:google-client-id'
const SCRIPT = 'https://accounts.google.com/gsi/client'
const ID_TOKEN_KEY = 'studio:google-id-token'

type CredentialResponse = { credential?: string; error?: string }

export type GoogleButtonOptions = {
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number
}

type IdApi = {
  initialize: (cfg: {
    client_id: string
    callback: (resp: CredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }) => void
  prompt: (momentListener?: (n: { isNotDisplayed?: () => boolean; isSkippedMoment?: () => boolean }) => void) => void
  renderButton: (parent: HTMLElement, options: GoogleButtonOptions) => void
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

function storeIdToken(credential: string) {
  idToken = credential
  sessionStorage.setItem(ID_TOKEN_KEY, idToken)
  notify()
}

function initIdClient(id: IdApi, clientId: string, onCredential: (credential: string) => void, onError?: (message: string) => void) {
  id.initialize({
    client_id: clientId,
    callback: (resp) => {
      if (!resp.credential) {
        onError?.(resp.error || 'Google sign-in was cancelled.')
        return
      }
      onCredential(resp.credential)
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  })
}

/** Official Google Sign-In button (GIS `renderButton`). Cleanup clears the host element. */
export async function mountGoogleSignInButton(
  parent: HTMLElement,
  options: GoogleButtonOptions & { onError?: (message: string) => void } = {},
): Promise<() => void> {
  const cid = appGoogleClientId()
  if (!cid) {
    throw new Error('Google sign-in isn’t configured. Set VITE_GOOGLE_CLIENT_ID in .env.local.')
  }
  const { onError, ...button } = options
  const id = await loadIdApi()
  initIdClient(id, cid, storeIdToken, onError)
  const token = {}
  ;(parent as HTMLElement & { __gsiMount?: object }).__gsiMount = token
  parent.replaceChildren()
  id.renderButton(parent, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
    // Omit width so GIS sizes to content — stretching makes the G/label look broken.
    ...button,
  })
  return () => {
    const host = parent as HTMLElement & { __gsiMount?: object }
    // Ignore stale disposers from React Strict Mode / overlapping mounts.
    if (host.__gsiMount !== token) return
    host.replaceChildren()
    delete host.__gsiMount
  }
}

export async function signInApp(): Promise<string> {
  const cid = appGoogleClientId()
  if (!cid) {
    throw new Error('Google sign-in isn’t configured. Set VITE_GOOGLE_CLIENT_ID in .env.local.')
  }
  const id = await loadIdApi()
  return new Promise((resolve, reject) => {
    initIdClient(
      id,
      cid,
      (credential) => {
        storeIdToken(credential)
        resolve(credential)
      },
      (message) => reject(new Error(message)),
    )
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

const CLIENT_KEY = 'studio:google-client-id'
const SCRIPT = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'

type TokenClient = { requestAccessToken: (opts?: { prompt?: string }) => void }

type Gis = {
  accounts: {
    oauth2: {
      initTokenClient: (cfg: {
        client_id: string
        scope: string
        callback: (resp: { access_token?: string; error?: string; error_description?: string }) => void
      }) => TokenClient
      revoke: (token: string, done?: () => void) => void
    }
    id?: {
      initialize: (cfg: unknown) => void
      prompt: (momentListener?: (n: unknown) => void) => void
      disableAutoSelect: () => void
    }
  }
}

declare global {
  interface Window {
    google?: Gis
  }
}

let token: string | null = null
const listeners = new Set<() => void>()

function notify() {
  for (const l of listeners) l()
}

export function subscribeGoogle(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function googleClientId(): string {
  return localStorage.getItem(CLIENT_KEY)?.trim() || String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()
}

export function setGoogleClientId(id: string) {
  const next = id.trim()
  if (next) localStorage.setItem(CLIENT_KEY, next)
  else localStorage.removeItem(CLIENT_KEY)
  notify()
}

export function googleAccessToken(): string | null {
  return token
}

function loadScript(): Promise<Gis> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google)
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT}"]`)
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.google) resolve(window.google)
        else reject(new Error('Google sign-in failed to load.'))
      })
      return
    }
    const el = document.createElement('script')
    el.src = SCRIPT
    el.async = true
    el.onload = () => {
      if (window.google) resolve(window.google)
      else reject(new Error('Google sign-in failed to load.'))
    }
    el.onerror = () => reject(new Error('Could not load Google sign-in.'))
    document.head.appendChild(el)
  })
}

export async function signInGoogle(): Promise<string> {
  const clientId = googleClientId()
  if (!clientId) {
    throw new Error('Google sign-in isn’t configured. Set VITE_GOOGLE_CLIENT_ID in .env.local.')
  }
  const gis = await loadScript()
  return new Promise((resolve, reject) => {
    const client = gis.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          reject(new Error(resp.error_description || resp.error || 'Google sign-in was cancelled.'))
          return
        }
        token = resp.access_token
        notify()
        resolve(token)
      },
    })
    client.requestAccessToken()
  })
}

export function signOutGoogle() {
  const current = token
  token = null
  notify()
  if (current && window.google?.accounts.oauth2.revoke) {
    window.google.accounts.oauth2.revoke(current)
  }
}

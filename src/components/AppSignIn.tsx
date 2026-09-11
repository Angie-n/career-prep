import { useEffect, useRef, useState } from 'react'
import {
  appGoogleClientId,
  appIdToken,
  fetchMe,
  mountGoogleSignInButton,
  signOutApp,
  subscribeAppAuth,
  type ApiUser,
} from '../lib/appAuth'
import { getSyncStatus, resetSyncStatus, subscribeSyncStatus, type SyncStatus } from '../lib/cloudSync'

function syncLabel(s: SyncStatus): string | null {
  if (s.kind === 'syncing') return s.detail || 'Syncing…'
  if (s.kind === 'synced') return 'Cloud synced'
  if (s.kind === 'error') return s.message
  return null
}

/** Account sign-in for Worker/D1 (Google ID token). Separate from Sheets connect. */
export function AppSignIn() {
  const [token, setToken] = useState(appIdToken)
  const [user, setUser] = useState<ApiUser | null>(null)
  const [error, setError] = useState('')
  const [sync, setSync] = useState(getSyncStatus)
  const gsiRef = useRef<HTMLDivElement>(null)
  const configured = Boolean(appGoogleClientId())

  useEffect(() => subscribeAppAuth(() => setToken(appIdToken())), [])
  useEffect(() => subscribeSyncStatus(() => setSync(getSyncStatus())), [])

  useEffect(() => {
    if (!token) {
      setUser(null)
      return
    }
    let cancelled = false
    fetchMe()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setUser(null)
          setError(e instanceof Error ? e.message : 'Could not verify session.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!configured || token || !gsiRef.current) return
    const host = gsiRef.current
    let cancelled = false
    let cleanup: (() => void) | undefined

    void mountGoogleSignInButton(host, {
      onError: (message) => {
        if (!cancelled) setError(message)
      },
    })
      .then((dispose) => {
        if (cancelled) dispose()
        else cleanup = dispose
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load Google sign-in.')
      })

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [configured, token])

  if (!configured) {
    return <p className="muted">App sign-in isn’t configured (missing VITE_GOOGLE_CLIENT_ID).</p>
  }

  const syncText = syncLabel(sync)

  return (
    <div className="stack">
      <div className="row">
        {token ? (
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              signOutApp()
              resetSyncStatus()
              setUser(null)
              setError('')
            }}
          >
            Sign out
          </button>
        ) : (
          <div className="welcome-gsi app-gsi" ref={gsiRef} />
        )}
        {user ? (
          <span className="chip ember">{user.email || user.name || 'Signed in'}</span>
        ) : token ? (
          <span className="chip">Checking…</span>
        ) : null}
      </div>
      {syncText ? (
        <p className={sync.kind === 'error' ? 'muted' : 'faint'}>{syncText}</p>
      ) : null}
      {error ? <p className="muted">{error}</p> : null}
    </div>
  )
}

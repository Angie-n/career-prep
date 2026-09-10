import { useEffect, useState } from 'react'
import {
  appGoogleClientId,
  appIdToken,
  fetchMe,
  signInApp,
  signOutApp,
  subscribeAppAuth,
  type ApiUser,
} from '../lib/appAuth'

/** Account sign-in for Worker/D1 (Google ID token). Separate from Sheets connect. */
export function AppSignIn() {
  const [token, setToken] = useState(appIdToken)
  const [user, setUser] = useState<ApiUser | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const configured = Boolean(appGoogleClientId())

  useEffect(() => subscribeAppAuth(() => setToken(appIdToken())), [])

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

  if (!configured) {
    return <p className="muted">App sign-in isn’t configured (missing VITE_GOOGLE_CLIENT_ID).</p>
  }

  return (
    <div className="stack">
      <div className="row">
        {token ? (
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              signOutApp()
              setUser(null)
              setError('')
            }}
          >
            Sign out
          </button>
        ) : (
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setError('')
              signInApp()
                .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Sign-in failed.'))
                .finally(() => setBusy(false))
            }}
          >
            Sign in with Google
          </button>
        )}
        {user ? (
          <span className="chip ember">{user.email || user.name || 'Signed in'}</span>
        ) : token ? (
          <span className="chip">Checking…</span>
        ) : null}
      </div>
      {error ? <p className="muted">{error}</p> : null}
    </div>
  )
}

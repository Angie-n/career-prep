import { useEffect, useState } from 'react'
import {
  googleAccessToken,
  googleClientId,
  signInGoogle,
  signOutGoogle,
  subscribeGoogle,
} from '../lib/googleAuth'

/** Minimal Google sign-in for private sheets. Client ID comes from VITE_GOOGLE_CLIENT_ID. */
export function GoogleConnect({ compact = false }: { compact?: boolean }) {
  const [token, setToken] = useState(googleAccessToken)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const configured = Boolean(googleClientId())

  useEffect(() => subscribeGoogle(() => setToken(googleAccessToken())), [])

  if (!configured && !token) {
    return compact ? null : (
      <p className="muted">Google sign-in isn’t configured for this build.</p>
    )
  }

  return (
    <div className="stack">
      <div className="row">
        {token ? (
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              signOutGoogle()
              setError('')
            }}
          >
            {compact ? 'Sign out of Google' : 'Revoke Sheets access'}
          </button>
        ) : (
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              setError('')
              signInGoogle()
                .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Sign-in failed.'))
                .finally(() => setBusy(false))
            }}
          >
            {compact ? 'Sign in with Google' : 'Allow access to Google Sheets'}
          </button>
        )}
        {token && !compact ? <span className="chip ember">Sheets connected</span> : null}
      </div>
      {error ? <p className="muted">{error}</p> : null}
    </div>
  )
}

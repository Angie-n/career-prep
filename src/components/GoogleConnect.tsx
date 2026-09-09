import { useEffect, useState } from 'react'
import {
  googleAccessToken,
  googleClientId,
  setGoogleClientId,
  signInGoogle,
  signOutGoogle,
  subscribeGoogle,
} from '../lib/googleAuth'

export function GoogleConnect() {
  const [clientId, setClientId] = useState(googleClientId)
  const [token, setToken] = useState(googleAccessToken)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeGoogle(() => setToken(googleAccessToken())), [])

  return (
    <section className="card stack">
      <p className="kicker">Private access</p>
      <h2>Keep the sheet restricted</h2>
      <p className="muted">
        Do not use “anyone with the link.” Import a CSV (File → Download in Google Sheets), or sign in so this app
        reads the sheet as you. Nothing is written back. The CSV copy stays in this browser.
      </p>
      <label className="field">
        Google OAuth client ID (once)
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          onBlur={() => setGoogleClientId(clientId)}
          placeholder="….apps.googleusercontent.com"
        />
      </label>
      <p className="faint">
        Google Cloud → APIs → enable Google Sheets API → Credentials → OAuth client ID (Web). Add this origin, e.g.
        http://localhost:5188
      </p>
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
            Sign out of Google
          </button>
        ) : (
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={() => {
              setGoogleClientId(clientId)
              setBusy(true)
              setError('')
              signInGoogle()
                .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Sign-in failed.'))
                .finally(() => setBusy(false))
            }}
          >
            Sign in with Google
          </button>
        )}
        {token ? <span className="chip ember">Signed in — private sheets OK</span> : null}
      </div>
      {error ? <p className="muted">{error}</p> : null}
    </section>
  )
}

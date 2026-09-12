import { useEffect, useRef, useState } from 'react'
import {
  appGoogleClientId,
  isAppSignedIn,
  mountGoogleSignInButton,
  subscribeAppAuth,
} from '../lib/appAuth'
import { CATEGORY_LABEL, type Category } from '../lib/types'
import { markEnteredWorkspace } from '../lib/workspaceEntry'

type Props = {
  onEntered: () => void
}

function CategoryMark({ category }: { category: Category }) {
  const label = CATEGORY_LABEL[category]
  return (
    <span className={`welcome-mark cat-${category}`} title={label} aria-hidden="true">
      {category === 'applications' ? (
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <rect x="14" y="10" width="40" height="52" rx="6" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <path d="M28 10v-2a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v2" fill="none" stroke="currentColor" strokeWidth="3.5" />
          <path d="M24 28h20M24 38h16M24 48h12" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="58" cy="54" r="14" fill="currentColor" opacity="0.18" />
          <path d="M58 47v14M51 54h14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 80 80" aria-hidden="true">
          <path
            d="M18 24c0-8 8-14 22-14s22 6 22 14v10c0 8-8 14-22 14h-4l-10 10v-12c-5-2-8-7-8-12V24z"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M30 28h20M30 38h14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}

/** First-visit gate: Google sign-in or continue without an account. */
export function WelcomeGate({ onEntered }: Props) {
  const [error, setError] = useState('')
  const gsiRef = useRef<HTMLDivElement>(null)
  const configured = Boolean(appGoogleClientId())

  useEffect(() => {
    return subscribeAppAuth(() => {
      if (isAppSignedIn()) {
        markEnteredWorkspace()
        onEntered()
      }
    })
  }, [onEntered])

  useEffect(() => {
    if (!configured || !gsiRef.current) return
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
  }, [configured])

  const enterAnonymous = () => {
    markEnteredWorkspace()
    onEntered()
  }

  return (
    <div className="welcome-gate">
      <div className="welcome-gate-layout">
        <aside className="welcome-gate-visual" aria-hidden="true">
          <div className="welcome-marks">
            <CategoryMark category="applications" />
            <CategoryMark category="communication" />
          </div>
        </aside>

        <div className="welcome-gate-panel">
          <div className="page-head">
            <p className="kicker">Career Studio</p>
            <h1>Start practicing</h1>
            <p className="lead">
              A focused space for interview prep — timed sessions for applications and behavioral
              stories, with goals and history so you keep showing up.
            </p>
            <p className="muted">
              Sign in to sync your data across devices, or continue on this browser only.
            </p>
          </div>

          <div className="stack welcome-gate-actions">
            {configured ? (
              <div className="welcome-gsi" ref={gsiRef} />
            ) : (
              <p className="muted">Google sign-in isn’t configured for this build.</p>
            )}
            <button className="welcome-skip" type="button" onClick={enterAnonymous}>
              Continue without signing in
            </button>
          </div>

          {error ? <p className="muted">{error}</p> : null}
          <p className="faint">
            You can sign in later from Account. Signing in enables cloud sync; anonymous data stays on
            this device until you do.
          </p>
        </div>
      </div>
    </div>
  )
}

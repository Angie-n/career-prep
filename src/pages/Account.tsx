import { AppSignIn } from '../components/AppSignIn'

export function Account() {
  return (
    <div className="stack">
      <div className="page-head">
        <p className="kicker">Account</p>
        <h1>Your account</h1>
        <p className="lead">Manage your Google connection for cloud saves.</p>
      </div>

      <section className="card stack">
        <h2>Connect your Google account</h2>
        <p className="muted">
          Saves your studio to the cloud — stories, sessions, goals, and applications — so you can
          continue on another device. Sign out clears this browser; your cloud copy stays. Audio stays
          on-device.
        </p>
        <AppSignIn />
      </section>
    </div>
  )
}

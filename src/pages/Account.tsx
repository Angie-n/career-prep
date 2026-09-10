import { AppSignIn } from '../components/AppSignIn'

export function Account() {
  return (
    <div className="stack">
      <div className="page-head">
        <p className="kicker">Account</p>
        <h1>Your account</h1>
        <p className="lead">
          Sign in so stories, sessions, goals, and sheet links sync to the cloud. Audio stays on this
          device; Sheets connect is separate.
        </p>
      </div>

      <section className="card">
        <h2>Sign in</h2>
        <AppSignIn />
      </section>
    </div>
  )
}

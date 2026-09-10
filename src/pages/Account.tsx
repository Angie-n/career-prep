import { AppSignIn } from '../components/AppSignIn'

export function Account() {
  return (
    <div className="stack">
      <div className="page-head">
        <p className="kicker">Account</p>
        <h1>Your account</h1>
        <p className="lead">Sign in so your data can sync to the cloud. Sheets connect stays separate.</p>
      </div>

      <section className="card">
        <h2>Sign in</h2>
        <AppSignIn />
      </section>
    </div>
  )
}

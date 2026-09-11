import { AppSignIn } from '../components/AppSignIn'
import { GoogleConnect } from '../components/GoogleConnect'

export function Account() {
  return (
    <div className="stack">
      <div className="page-head">
        <p className="kicker">Account</p>
        <h1>Your account</h1>
        <p className="lead">
          Manage Google connections for cloud saves and for reading private tracker spreadsheets.
        </p>
      </div>

      <section className="card stack">
        <h2>Connect your Google account</h2>
        <p className="muted">
          Saves your studio to the cloud — stories, sessions, goals, and sheet links — so you can
          continue on another device. Sign out clears this browser; your cloud copy stays. Audio stays
          on-device.
        </p>
        <AppSignIn />
      </section>

      <section className="card stack">
        <h2>Allow access to Google Sheets</h2>
        <p className="muted">
          Optional. Grants read-only access so Career Studio can open private application and DSA
          trackers you paste in. Separate from cloud save — revoke anytime without signing out of your
          account.
        </p>
        <GoogleConnect />
      </section>
    </div>
  )
}

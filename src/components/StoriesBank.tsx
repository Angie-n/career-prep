import { Link } from 'react-router-dom'
import { CategorySubnav } from './CategorySubnav'
import { cue } from '../lib/ids'
import { useStore } from '../state/Store'

export function StoriesBank() {
  const { state } = useStore()

  return (
    <div className="stack">
      <div>
        <p className="kicker">Communication</p>
        <h1>Stories</h1>
        <p className="lead">Experiences to pull from — projects, internships, messy weeks.</p>
      </div>
      <CategorySubnav category="communication" />
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2>Your stories</h2>
            <p className="muted">Not tied to a specific prompt. Use them when drafting answers.</p>
          </div>
          <Link className="btn subtle" to="/practice/stories/new">
            Add
          </Link>
        </div>
        {state.stories.length === 0 ? (
          <p className="empty" style={{ marginTop: 12 }}>
            Add a project, internship, or messy week.
          </p>
        ) : (
          <div className="grid-2" style={{ marginTop: 16 }}>
            {state.stories.map((s) => (
              <Link className="card story-card" key={s.id} to={`/practice/stories/${s.id}`}>
                <h3>{s.title}</h3>
                <p className="muted">{cue(s.notes, 18) || 'No notes yet.'}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { cue, uid } from '../lib/ids'
import { allQuestions } from '../lib/sessionPlan'
import { useStore } from '../state/Store'

export function CommunicationBank() {
  const { state, dispatch } = useStore()
  const [prompt, setPrompt] = useState('')
  const [showPrompts, setShowPrompts] = useState(false)
  const questions = allQuestions(state.customQuestions)

  function saveQuestion() {
    const text = prompt.trim()
    if (!text) return
    dispatch({
      type: 'upsert-question',
      question: { id: uid(), prompt: text, custom: true },
    })
    setPrompt('')
  }

  return (
    <div className="stack">
      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="kicker">Notes</p>
            <h2>Stories</h2>
            <p className="muted">Experiences to pull from. Not tied to a specific prompt.</p>
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

      <section className="card">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p className="kicker">Bank</p>
            <h2>Prompts ({questions.length})</h2>
            <p className="muted">Drills pick from these. Add one if something is missing.</p>
          </div>
          <button className="btn subtle" type="button" onClick={() => setShowPrompts((v) => !v)}>
            {showPrompts ? 'Hide' : 'Show'}
          </button>
        </div>
        {showPrompts ? (
          <div className="stack" style={{ marginTop: 16 }}>
            <label className="field">
              New prompt
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} />
            </label>
            <div>
              <button className="btn subtle" type="button" onClick={saveQuestion} disabled={!prompt.trim()}>
                Add prompt
              </button>
            </div>
            {questions.map((q) => (
              <article className="card quiet" key={q.id}>
                <h3>{q.prompt}</h3>
                {q.custom ? (
                  <div style={{ marginTop: 12 }}>
                    <button className="btn ghost" type="button" onClick={() => dispatch({ type: 'delete-question', id: q.id })}>
                      Remove
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  )
}

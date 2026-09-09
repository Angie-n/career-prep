import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CategorySubnav } from '../components/CategorySubnav'
import type { Story } from '../lib/types'
import { newStoryDraft, useStore } from '../state/Store'

export function StoryEditor() {
  const { id } = useParams()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const existing = state.stories.find((s) => s.id === id)
  const [draft, setDraft] = useState<Story>(() => existing ?? newStoryDraft())

  useEffect(() => {
    const found = state.stories.find((s) => s.id === id)
    setDraft(found ?? newStoryDraft())
  }, [id, state.stories])

  const heading = useMemo(() => (existing ? 'Edit story' : 'New story'), [existing])

  function save() {
    dispatch({
      type: 'upsert-story',
      story: { ...draft, updatedAt: new Date().toISOString(), title: draft.title.trim() || 'Untitled story' },
    })
    navigate('/practice/stories')
  }

  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <CategorySubnav category="communication" />
      <Link className="muted" to="/practice/stories">
        ← Stories
      </Link>
      <p className="kicker">{heading}</p>
      <h1>{draft.title || 'Name the experience'}</h1>
      <label className="field">
        Title
        <input
          type="text"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Search latency work, intern marketplace…"
        />
      </label>
      <label className="field">
        Notes
        <textarea
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          placeholder="What happened, what you chose, how it turned out."
        />
      </label>
      <div className="row">
        <button className="btn" type="button" onClick={save}>
          Save
        </button>
        {existing ? (
          <button
            className="btn ghost"
            type="button"
            onClick={() => {
              dispatch({ type: 'delete-story', id: existing.id })
              navigate('/practice/stories')
            }}
          >
            Delete
          </button>
        ) : null}
      </div>
    </div>
  )
}

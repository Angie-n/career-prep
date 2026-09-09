import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CategorySubnav } from './CategorySubnav'
import { uid } from '../lib/ids'
import { questionsForCategory } from '../lib/sessionPlan'
import type { PromptCategory, Question } from '../lib/types'
import { newPromptCategoryDraft, useStore } from '../state/Store'

export function PromptsBank() {
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState(() => newPromptCategoryDraft())

  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const c of state.promptCategories) {
      map.set(
        c.id,
        questionsForCategory(c.id, state.customQuestions, state.removedQuestionIds).length,
      )
    }
    return map
  }, [state.promptCategories, state.customQuestions, state.removedQuestionIds])

  function saveCategory() {
    const title = draft.title.trim()
    if (!title) return
    const now = new Date().toISOString()
    const category: PromptCategory = {
      ...draft,
      title,
      description: draft.description.trim(),
      updatedAt: now,
      createdAt: draft.createdAt || now,
      builtin: false,
    }
    dispatch({ type: 'upsert-prompt-category', category })
    setCreating(false)
    setDraft(newPromptCategoryDraft())
    navigate(`/practice/prompts/${category.id}`)
  }

  return (
    <div className="stack">
      <div>
        <p className="kicker">Communication</p>
        <h1>Prompts</h1>
        <p className="lead">
          Group questions by theme. Behavioral covers the usual interview asks — add a category for
          a resume project when you want targeted drills.
        </p>
      </div>
      <CategorySubnav category="communication" />

      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button
          className="btn subtle"
          type="button"
          onClick={() => {
            setDraft(newPromptCategoryDraft())
            setCreating((v) => !v)
          }}
        >
          {creating ? 'Cancel' : 'Add category'}
        </button>
      </div>

      {creating ? (
        <section className="card">
          <h2>New category</h2>
          <p className="muted">
            e.g. a project on your resume, system design depth, role-specific asks.
          </p>
          <label className="field" style={{ marginTop: 12 }}>
            Title
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Search latency work"
            />
          </label>
          <label className="field">
            Description
            <textarea
              rows={3}
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="What this bank is for — interviewers, themes, scope."
            />
          </label>
          <div>
            <button className="btn" type="button" onClick={saveCategory} disabled={!draft.title.trim()}>
              Create
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid-2">
        {[...state.promptCategories]
          .sort((a, b) => Number(b.builtin) - Number(a.builtin) || a.title.localeCompare(b.title))
          .map((c) => {
            const n = counts.get(c.id) ?? 0
            return (
              <Link className="card story-card" key={c.id} to={`/practice/prompts/${c.id}`}>
                <h3 style={{ margin: 0 }}>{c.title}</h3>
                <p className="muted" style={{ marginTop: 8 }}>
                  {c.description || 'No description yet.'}
                </p>
                <p className="faint" style={{ marginTop: 10 }}>
                  {n === 1 ? '1 prompt' : `${n} prompts`}
                </p>
              </Link>
            )
          })}
      </div>
    </div>
  )
}

export function PromptCategoryDetail() {
  const { categoryId } = useParams()
  const { state, dispatch } = useStore()
  const navigate = useNavigate()
  const category = state.promptCategories.find((c) => c.id === categoryId)
  const questions = category
    ? questionsForCategory(category.id, state.customQuestions, state.removedQuestionIds)
    : []

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  useEffect(() => {
    if (!category) return
    setTitle(category.title)
    setDescription(category.description)
    setEditing(false)
    setEditingId(null)
    setNewPrompt('')
  }, [category])

  if (!category) {
    return (
      <div className="stack">
        <CategorySubnav category="communication" />
        <p className="muted">Category not found.</p>
        <Link to="/practice/prompts">← Prompts</Link>
      </div>
    )
  }

  // Narrowed binding so nested handlers keep a defined PromptCategory.
  const cat = category

  function enterEdit() {
    setTitle(cat.title)
    setDescription(cat.description)
    setEditingId(null)
    setNewPrompt('')
    setEditing(true)
  }

  function cancelEdit() {
    setTitle(cat.title)
    setDescription(cat.description)
    setEditingId(null)
    setNewPrompt('')
    setEditing(false)
  }

  function doneEdit() {
    const nextTitle = title.trim() || cat.title
    dispatch({
      type: 'upsert-prompt-category',
      category: {
        ...cat,
        title: nextTitle,
        description: description.trim(),
        updatedAt: new Date().toISOString(),
      },
    })
    setEditing(false)
    setEditingId(null)
    setNewPrompt('')
  }

  function addPrompt() {
    const text = newPrompt.trim()
    if (!text) return
    dispatch({
      type: 'upsert-question',
      question: {
        id: uid(),
        prompt: text,
        custom: true,
        categoryId: cat.id,
      },
    })
    setNewPrompt('')
  }

  function startEditPrompt(q: Question) {
    setEditingId(q.id)
    setEditText(q.prompt)
  }

  function saveEditPrompt(q: Question) {
    const text = editText.trim()
    if (!text) return
    dispatch({
      type: 'upsert-question',
      question: { ...q, prompt: text, categoryId: cat.id },
    })
    setEditingId(null)
    setEditText('')
  }

  function removeCategory() {
    if (cat.builtin) return
    dispatch({ type: 'delete-prompt-category', id: cat.id })
    navigate('/practice/prompts')
  }

  const displayTitle = editing ? title : cat.title
  const displayDescription = editing ? description : cat.description

  return (
    <div className="stack prompt-category" style={{ maxWidth: 720 }}>
      <CategorySubnav category="communication" />
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Link className="muted" to="/practice/prompts">
          ← Prompts
        </Link>
        {editing ? (
          <div className="row">
            <button className="btn ghost" type="button" onClick={cancelEdit}>
              Cancel
            </button>
            <button className="btn subtle" type="button" onClick={doneEdit}>
              Done
            </button>
          </div>
        ) : (
          <button className="btn subtle" type="button" onClick={enterEdit}>
            Edit
          </button>
        )}
      </div>

      {editing ? (
        <input
          className="prompt-cat-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Category title"
        />
      ) : (
        <h1 className="prompt-cat-title">{displayTitle}</h1>
      )}

      {editing ? (
        <textarea
          className="prompt-cat-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this bank is for."
          aria-label="Category description"
        />
      ) : displayDescription ? (
        <p className="prompt-cat-desc lead">{displayDescription}</p>
      ) : (
        <p className="prompt-cat-desc lead faint">No description yet.</p>
      )}

      <section>
        <h2>{questions.length === 1 ? '1 prompt' : `${questions.length} prompts`}</h2>
        <p className="muted">Drills use the categories you pick on Practice.</p>

        <ul className="prompt-list">
          {questions.length === 0 && !editing ? (
            <li className="prompt-list-empty">No prompts in this category yet.</li>
          ) : null}
          {questions.map((q) => (
            <li className="prompt-list-row" key={q.id}>
              {editing && editingId === q.id ? (
                <div className="prompt-list-edit">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    aria-label="Edit prompt"
                  />
                  <div className="row">
                    <button
                      className="btn subtle"
                      type="button"
                      onClick={() => saveEditPrompt(q)}
                      disabled={!editText.trim()}
                    >
                      Save
                    </button>
                    <button className="btn ghost" type="button" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="prompt-list-text">{q.prompt}</p>
                  {editing ? (
                    <div className="prompt-list-actions">
                      <button className="btn ghost" type="button" onClick={() => startEditPrompt(q)}>
                        Edit
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => dispatch({ type: 'delete-question', id: q.id })}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          ))}
          {editing ? (
            <li className="prompt-list-row prompt-list-add">
              <textarea
                value={newPrompt}
                onChange={(e) => setNewPrompt(e.target.value)}
                rows={2}
                placeholder="Add a prompt…"
                aria-label="New prompt"
              />
              <div className="row">
                <button
                  className="btn subtle"
                  type="button"
                  onClick={addPrompt}
                  disabled={!newPrompt.trim()}
                >
                  Add
                </button>
              </div>
            </li>
          ) : null}
        </ul>
      </section>

      {editing && !category.builtin ? (
        <div>
          <button className="btn ghost" type="button" onClick={removeCategory}>
            Delete category
          </button>
          <p className="faint" style={{ marginTop: 8 }}>
            Prompts move to Behavioral.
          </p>
        </div>
      ) : null}
    </div>
  )
}

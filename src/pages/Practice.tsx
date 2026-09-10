import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryGlance } from '../components/CategoryGlance'
import { CategorySubnav } from '../components/CategorySubnav'
import { InProgressPager } from '../components/InProgressPager'
import { MinutesPicker } from '../components/MinutesPicker'
import {
  activeSessionPath,
  buildSession,
  previousDrafts,
  questionsForCategories,
} from '../lib/sessionPlan'
import {
  SESSION_META,
  clampMinutes,
  durationFor,
  type DurationKind,
  type SessionAnswer,
  type SessionKind,
} from '../lib/types'
import { inProgressForKind, useInProgressSessionsForCategory, useStore } from '../state/Store'

export function Practice() {
  const { state, dispatch } = useStore()
  const live = useInProgressSessionsForCategory('communication')
  const navigate = useNavigate()
  const [pickedDraft, setPickedDraft] = useState<SessionAnswer | ''>('')
  const drafts = previousDrafts(state.sessions)

  const categories = useMemo(
    () =>
      [...state.promptCategories].sort(
        (a, b) => Number(b.builtin) - Number(a.builtin) || a.title.localeCompare(b.title),
      ),
    [state.promptCategories],
  )

  const selectedIds = useMemo(() => {
    const valid = new Set(categories.map((c) => c.id))
    return state.drillPromptCategoryIds.filter((id) => valid.has(id))
  }, [categories, state.drillPromptCategoryIds])

  const poolCount = questionsForCategories(
    selectedIds,
    state.customQuestions,
    state.removedQuestionIds,
  ).length

  function toggleCategory(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    dispatch({ type: 'set-drill-prompt-categories', ids: next })
  }

  function start(kind: SessionKind) {
    const existing = inProgressForKind(state, kind)
    if (existing) {
      navigate(activeSessionPath(existing.id))
      return
    }
    const draft = kind === 'comm-deliver' ? pickedDraft || drafts[0] : undefined
    const built = buildSession(kind, state.customQuestions, {
      draft,
      minutes: durationFor(state.durations, kind),
      removedQuestionIds: state.removedQuestionIds,
      promptCategoryIds: selectedIds,
    })
    dispatch({ type: 'start-session', session: built })
    navigate(activeSessionPath(built.id))
  }

  function activityCard(k: SessionKind, extraClass = '') {
    const existing = inProgressForKind(state, k)
    const blocked =
      !existing &&
      (k === 'comm-deliver'
        ? drafts.length === 0
        : selectedIds.length === 0 || poolCount === 0)
    return (
      <section className={`card action start-card ${extraClass}`.trim()} key={k}>
        <div className="start-card-copy">
          <h2>{SESSION_META[k].title}</h2>
          <p className="muted">{SESSION_META[k].blurb}</p>
        </div>
        <div className="start-card-actions">
          {!existing ? (
            <MinutesPicker
              value={durationFor(state.durations, k)}
              onChange={(minutes) =>
                dispatch({
                  type: 'set-durations',
                  durations: {
                    ...state.durations,
                    [k]: clampMinutes(minutes, state.durations[k as DurationKind]),
                  },
                })
              }
            />
          ) : null}
          <button className="btn" type="button" onClick={() => start(k)} disabled={blocked}>
            {existing ? 'Resume' : 'Start now'}
          </button>
        </div>
      </section>
    )
  }

  return (
    <div className="stack">
      <div className="page-head">
        <p className="kicker">Communication</p>
        <h1>Practice Delivering</h1>
        <p className="lead">Draft. Deliver. Or go cold — get reps in.</p>
      </div>
      <CategorySubnav category="communication" />
      <CategoryGlance category="communication" />
      <InProgressPager sessions={live} headingLevel="h2" />

      <section className="card quiet">
        <h2>Prompt categories</h2>
        <p className="muted">
          Choose which banks Draft and Rapid Fire draw from
          {selectedIds.length > 0 ? ` · ${poolCount} prompt${poolCount === 1 ? '' : 's'}` : ''}.
        </p>
        <div className="prompt-cat-picks" role="group" aria-label="Prompt categories for drills">
          {categories.map((c) => {
            const on = selectedIds.includes(c.id)
            return (
              <button
                key={c.id}
                type="button"
                className={`prompt-cat-pick${on ? ' is-on' : ''}`}
                aria-pressed={on}
                onClick={() => toggleCategory(c.id)}
              >
                {c.title}
              </button>
            )
          })}
        </div>
        {selectedIds.length === 0 ? (
          <p className="faint" style={{ marginTop: 10 }}>
            Select at least one category to start Draft or Rapid Fire.
          </p>
        ) : null}
      </section>

      {drafts.length > 0 ? (
        <label className="field" style={{ maxWidth: 520 }}>
          Draft to speak from
          <select
            value={pickedDraft ? `${pickedDraft.questionId}|${pickedDraft.storyId ?? ''}` : ''}
            onChange={(e) => {
              const next = drafts.find((d) => `${d.questionId}|${d.storyId ?? ''}` === e.target.value)
              setPickedDraft(next ?? '')
            }}
          >
            <option value="">Use the latest draft</option>
            {drafts.slice(0, 20).map((d) => (
              <option key={d.questionId + (d.storyId ?? '')} value={`${d.questionId}|${d.storyId ?? ''}`}>
                {d.prompt.slice(0, 80)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="muted">Talk-from-draft needs a saved draft first. Draft and Rapid Fire can start now.</p>
      )}
      <div className="practice-paths">
        <div className="practice-flow" aria-label="Draft, then talk from that draft">
          <div className="practice-flow-nodes">
            {activityCard('comm-draft')}
            <div className="practice-flow-edge" aria-hidden="true">
              <span className="practice-flow-line" />
              <span className="practice-flow-arrow" />
            </div>
            {activityCard('comm-deliver')}
          </div>
        </div>
        {activityCard('comm-cold', 'practice-cold')}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CategoryGlance } from '../components/CategoryGlance'
import { CategorySubnav } from '../components/CategorySubnav'
import { MinutesPicker } from '../components/MinutesPicker'
import { ResumeSessionCard } from '../components/ResumeSessionCard'
import { SheetLog } from '../components/SheetLog'
import { uid } from '../lib/ids'
import { activeSessionPath, buildSession } from '../lib/sessionPlan'
import { retrieveDsaFromTrackers } from '../lib/retrieveDsa'
import { deleteSheetCsv } from '../lib/storage'
import {
  CATEGORY_LABEL,
  SESSION_META,
  clampMinutes,
  type Category,
  type NamedSheet,
  type SessionKind,
} from '../lib/types'
import { useInProgressForCategory, useStore } from '../state/Store'

export function WorkTrack({
  category,
  kind,
  pane = 'home',
}: {
  category: Extract<Category, 'applications' | 'dsa'>
  kind: Extract<SessionKind, 'apps-block' | 'dsa-block'>
  pane?: 'home' | 'tracker'
}) {
  const { state, dispatch } = useStore()
  const matchingActive = useInProgressForCategory(category)
  const navigate = useNavigate()
  const goalMinutes = state.goals[category]
  const [minutes, setMinutesLocal] = useState(goalMinutes)
  const [note, setNote] = useState('')
  const [starting, setStarting] = useState(false)
  const meta = SESSION_META[kind]
  const tracking = pane === 'tracker'
  const busy = Boolean(matchingActive)

  useEffect(() => {
    setMinutesLocal(goalMinutes)
  }, [goalMinutes])

  function setMinutes(next: number) {
    const value = clampMinutes(next, goalMinutes)
    setMinutesLocal(value)
    dispatch({
      type: 'set-durations',
      durations: { ...state.durations, [kind]: value },
    })
  }

  async function start() {
    if (matchingActive) {
      navigate(activeSessionPath(matchingActive.id))
      return
    }
    setStarting(true)
    try {
      const dsaRetrieved =
        kind === 'dsa-block'
          ? await retrieveDsaFromTrackers(state.sheets.dsa, note, { limit: 5 })
          : undefined

      const session = buildSession(kind, state.customQuestions, {
        minutes,
        note,
        dsaRetrieved,
        removedQuestionIds: state.removedQuestionIds,
      })
      dispatch({ type: 'start-session', session })
      navigate(activeSessionPath(session.id))
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="stack">
      <div>
        <p className="kicker">{CATEGORY_LABEL[category]}</p>
        <h1>{tracking ? 'Tracker' : meta.title}</h1>
        <p className="lead">
          {tracking
            ? category === 'applications'
              ? 'Application log from your sheet.'
              : 'Named sheet trackers for problems and notes.'
            : meta.blurb}
        </p>
      </div>

      <CategorySubnav category={category} />

      {tracking ? (
        <WorkTrackSheets category={category} />
      ) : (
        <>
          <CategoryGlance category={category} />
          {matchingActive ? <ResumeSessionCard session={matchingActive} headingLevel="h2" /> : null}
          <section className="card action start-card">
            <div className="start-card-copy">
              <h2>Log a focused block</h2>
              <p className="muted">
                {matchingActive
                  ? 'Or discard the session above to start a new block.'
                  : `This time counts only toward ${CATEGORY_LABEL[category].toLowerCase()}.`}
              </p>
            </div>
            <label className="field start-card-note">
              What are you working on? (optional)
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={category === 'applications' ? 'Company + role…' : 'Problem or topic…'}
                disabled={busy}
              />
            </label>
            <div className="start-card-actions">
              <MinutesPicker value={minutes} onChange={setMinutes} />
              <button
                className="btn"
                type="button"
                onClick={() => void start()}
                disabled={starting || busy}
              >
                {starting ? 'Loading…' : busy ? 'Resume first' : 'Start'}
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function WorkTrackSheets({ category }: { category: Extract<Category, 'applications' | 'dsa'> }) {
  const { state, dispatch } = useStore()
  const [searchParams] = useSearchParams()
  const focusSourceId = searchParams.get('sourceId') ?? ''

  const [sheetUrl, setSheetUrl] = useState(state.sheets.applications.url)
  const [dsaDrafts, setDsaDrafts] = useState<NamedSheet[]>(state.sheets.dsa)

  useEffect(() => {
    if (category !== 'dsa') return
    if (!focusSourceId.trim()) return
    const scroll = () => {
      const el = document.getElementById(`dsa-tracker-${focusSourceId}`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    scroll()
    // Sheet sections render from state; do a second attempt after paint.
    window.setTimeout(scroll, 0)
  }, [category, focusSourceId])

  function saveAppsSheet() {
    dispatch({
      type: 'set-sheets',
      sheets: {
        ...state.sheets,
        applications: {
          url: sheetUrl.trim(),
          importedAt: state.sheets.applications.importedAt,
        },
      },
    })
  }

  function saveDsa() {
    const next = dsaDrafts.map((s) => ({
      ...s,
      name: s.name.trim() || 'Tracker',
      url: s.url.trim(),
    }))
    setDsaDrafts(next)
    dispatch({
      type: 'set-sheets',
      sheets: { ...state.sheets, dsa: next },
    })
  }

  if (category === 'applications') {
    return (
      <section className="card stack">
        <p className="kicker">Spreadsheet</p>
        <h2>Application log</h2>
        <p className="muted">Paste the sheet URL for a live read. Private sheets prompt Google sign-in when needed.</p>
        <label className="field">
          Sheet URL
          <input
            type="text"
            value={sheetUrl}
            onChange={(e) => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…"
          />
        </label>
        <button className="btn ghost" type="button" onClick={saveAppsSheet}>
          Save link
        </button>
        <SheetLog url={state.sheets.applications.url} kind="applications" />
      </section>
    )
  }

  return (
    <div className="stack">
      <div>
        <p className="kicker">Spreadsheets</p>
        <h2>DSA trackers</h2>
        <p className="lead">Name each tracker and paste its sheet URL. Same columns: Date, Problem, Difficulty, Topics, Notes.</p>
      </div>
      {dsaDrafts.map((sheet, i) => (
        <section className="card stack" key={sheet.id} id={`dsa-tracker-${sheet.id}`}>
          <p className="kicker">Tracker {i + 1}</p>
          <label className="field">
            Name
            <input
              type="text"
              value={sheet.name}
              onChange={(e) =>
                setDsaDrafts((list) => list.map((s) => (s.id === sheet.id ? { ...s, name: e.target.value } : s)))
              }
              placeholder="NeetCode, Blind 75…"
            />
          </label>
          <label className="field">
            Sheet URL
            <input
              type="text"
              value={sheet.url}
              onChange={(e) =>
                setDsaDrafts((list) => list.map((s) => (s.id === sheet.id ? { ...s, url: e.target.value } : s)))
              }
              placeholder="https://docs.google.com/spreadsheets/d/…"
            />
          </label>
          <div className="row">
            <button className="btn ghost" type="button" onClick={saveDsa}>
              Save
            </button>
            {dsaDrafts.length > 1 ? (
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  const next = dsaDrafts.filter((s) => s.id !== sheet.id)
                  setDsaDrafts(next)
                  void deleteSheetCsv(sheet.id)
                  dispatch({ type: 'set-sheets', sheets: { ...state.sheets, dsa: next } })
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
          <SheetLog url={state.sheets.dsa.find((s) => s.id === sheet.id)?.url ?? ''} kind="dsa" />
        </section>
      ))}
      <div>
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            const next = [...dsaDrafts, { id: uid(), name: `Tracker ${dsaDrafts.length + 1}`, url: '' }]
            setDsaDrafts(next)
            dispatch({ type: 'set-sheets', sheets: { ...state.sheets, dsa: next } })
          }}
        >
          Add another sheet
        </button>
      </div>
    </div>
  )
}

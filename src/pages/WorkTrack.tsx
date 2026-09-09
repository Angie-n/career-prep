import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CategoryGlance } from '../components/CategoryGlance'
import { CategorySubnav } from '../components/CategorySubnav'
import { GoogleConnect } from '../components/GoogleConnect'
import { MinutesPicker } from '../components/MinutesPicker'
import { SheetLog } from '../components/SheetLog'
import { uid } from '../lib/ids'
import { buildSession } from '../lib/sessionPlan'
import { deleteSheetCsv } from '../lib/storage'
import {
  CATEGORY_LABEL,
  SESSION_META,
  clampMinutes,
  durationFor,
  type Category,
  type NamedSheet,
  type SessionKind,
} from '../lib/types'
import { useStore } from '../state/Store'

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
  const navigate = useNavigate()
  const minutes = durationFor(state.durations, kind)
  const [note, setNote] = useState('')
  const meta = SESSION_META[kind]
  const tracking = pane === 'tracker'

  function setMinutes(next: number) {
    dispatch({
      type: 'set-durations',
      durations: { ...state.durations, [kind]: clampMinutes(next, minutes) },
    })
  }

  function start() {
    const session = buildSession(kind, state.customQuestions, { minutes, note })
    dispatch({ type: 'start-session', session })
    navigate('/practice')
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
          <section className="card action start-card">
            <div className="start-card-copy">
              <h2>Log a focused block</h2>
              <p className="muted">This time counts only toward {CATEGORY_LABEL[category].toLowerCase()}.</p>
            </div>
            <label className="field start-card-note">
              What are you working on? (optional)
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={category === 'applications' ? 'Company + role…' : 'Problem or topic…'}
              />
            </label>
            <div className="start-card-actions">
              <MinutesPicker value={minutes} onChange={setMinutes} />
              <button className="btn" type="button" onClick={start}>
                Start
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
  const [sheetUrl, setSheetUrl] = useState(state.sheets.applications.url)
  const [dsaDrafts, setDsaDrafts] = useState<NamedSheet[]>(state.sheets.dsa)

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

  function markImported(id: string, iso: string) {
    if (category === 'applications') {
      dispatch({
        type: 'set-sheets',
        sheets: {
          ...state.sheets,
          applications: { url: sheetUrl.trim(), importedAt: iso },
        },
      })
      return
    }
    const next = dsaDrafts.map((s) => (s.id === id ? { ...s, importedAt: iso } : s))
    setDsaDrafts(next)
    dispatch({ type: 'set-sheets', sheets: { ...state.sheets, dsa: next } })
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
      <>
        <GoogleConnect />
        <section className="card stack">
          <p className="kicker">Spreadsheet</p>
          <h2>Application log</h2>
          <p className="muted">
            Keep the sheet private. Import a CSV, or paste the URL after signing in with Google. A public “anyone with
            the link” share is not required.
          </p>
          <label className="field">
            Sheet URL (for live Google read)
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
          <SheetLog
            sourceId="applications"
            url={state.sheets.applications.url}
            kind="applications"
            importedAt={state.sheets.applications.importedAt}
            onImported={(iso) => markImported('applications', iso)}
          />
        </section>
      </>
    )
  }

  return (
    <div className="stack">
      <GoogleConnect />
      <div>
        <p className="kicker">Spreadsheets</p>
        <h2>DSA trackers</h2>
        <p className="lead">
          Add each sheet you keep. Same columns: Date, Problem, Difficulty, Topics, Notes. Leave them restricted —
          import CSV or sign in with Google.
        </p>
      </div>
      {dsaDrafts.map((sheet, i) => (
        <section className="card stack" key={sheet.id}>
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
            Sheet URL (for live Google read)
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
          <SheetLog
            sourceId={sheet.id}
            url={state.sheets.dsa.find((s) => s.id === sheet.id)?.url ?? ''}
            kind="dsa"
            importedAt={state.sheets.dsa.find((s) => s.id === sheet.id)?.importedAt}
            onImported={(iso) => markImported(sheet.id, iso)}
          />
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

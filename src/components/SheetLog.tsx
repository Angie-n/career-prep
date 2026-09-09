import { useEffect, useMemo, useState } from 'react'
import { GoogleConnect } from './GoogleConnect'
import { googleAccessToken, subscribeGoogle } from '../lib/googleAuth'
import { loadSheetLog, type SheetLogVia } from '../lib/loadSheetLog'
import { filterRows, SHEET_META, type SheetKind, type SheetTable } from '../lib/sheets'

export function SheetLog({
  url,
  kind,
}: {
  url: string
  kind: SheetKind
}) {
  const meta = SHEET_META[kind]
  const [table, setTable] = useState<SheetTable | null>(null)
  const [via, setVia] = useState<SheetLogVia | ''>('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [signedIn, setSignedIn] = useState(Boolean(googleAccessToken()))

  useEffect(() => subscribeGoogle(() => setSignedIn(Boolean(googleAccessToken()))), [])

  useEffect(() => {
    let gone = false
    setLoading(true)
    setError('')
    loadSheetLog(url, kind)
      .then((result) => {
        if (gone) return
        if (!result) {
          setTable(null)
          setVia('')
          setError('')
          return
        }
        setTable(result.table)
        setVia(result.via)
      })
      .catch((e: unknown) => {
        if (gone) return
        setTable(null)
        setVia('')
        setError(e instanceof Error ? e.message : 'Could not load sheet.')
      })
      .finally(() => {
        if (!gone) setLoading(false)
      })
    return () => {
      gone = true
    }
  }, [url, kind, signedIn])

  const rows = useMemo(() => (table ? filterRows(table, query) : []), [table, query])

  const needsSignIn = Boolean(url.trim()) && !signedIn && !loading && !table && Boolean(error)
  const showStatus = Boolean(via) || needsSignIn || loading || (Boolean(error) && !needsSignIn) || Boolean(table)

  if (!showStatus) return null

  return (
    <div className="stack">
      {via === 'google' ? (
        <div className="row">
          <p className="faint">Live from your Google account.</p>
          <GoogleConnect compact />
        </div>
      ) : null}
      {via === 'link' ? <p className="faint">Loaded from a public sheet link.</p> : null}
      {needsSignIn ? (
        <div className="stack">
          <p className="muted">This sheet looks private. Sign in to read it live.</p>
          <GoogleConnect />
        </div>
      ) : null}
      {loading ? <p className="muted">Loading sheet…</p> : null}
      {error && !loading && !needsSignIn ? <p className="muted">{error}</p> : null}
      {table && !loading ? (
        <>
          <input type="text" value={query} placeholder={meta.search} onChange={(e) => setQuery(e.target.value)} />
          <p className="faint">
            {rows.length} of {table.rows.length} rows
          </p>
          {kind === 'applications' ? <AppsList rows={rows} /> : <DsaTable rows={rows} />}
        </>
      ) : null}
    </div>
  )
}

function AppsList({ rows }: { rows: Record<string, string>[] }) {
  if (rows.length === 0) return <p className="empty">No rows match.</p>
  return (
    <div className="stack">
      {rows.slice(0, 80).map((row, i) => (
        <article className="log-card" key={i}>
          <p className="kicker">{[row.Date, row.Role].filter(Boolean).join(' · ') || 'Application'}</p>
          <h3>{row.Company || row.Role || 'Untitled'}</h3>
          {row.Description ? <p className="muted">{row.Description}</p> : null}
        </article>
      ))}
    </div>
  )
}

function DsaTable({ rows }: { rows: Record<string, string>[] }) {
  if (rows.length === 0) return <p className="empty">No rows match.</p>
  return (
    <div className="sheet-wrap">
      <table className="sheet-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Problem</th>
            <th>Difficulty</th>
            <th>Topics</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 80).map((row, i) => (
            <tr key={i}>
              <td>{row.Date}</td>
              <td>{row.Problem}</td>
              <td>
                <span className={`diff ${diffClass(row.Difficulty)}`}>{row.Difficulty || '—'}</span>
              </td>
              <td>{row.Topics}</td>
              <td className="wrap">{row.Notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function diffClass(value: string): string {
  const v = value.trim().toLowerCase()
  if (v.startsWith('easy')) return 'easy'
  if (v.startsWith('med')) return 'medium'
  if (v.startsWith('hard')) return 'hard'
  return ''
}

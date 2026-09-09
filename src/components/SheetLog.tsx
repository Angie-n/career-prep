import { useEffect, useMemo, useState } from 'react'
import { loadGoogleSheet } from '../lib/googleSheets'
import { googleAccessToken, subscribeGoogle } from '../lib/googleAuth'
import { filterRows, loadPublicSheet, parseCsv, projectSheet, SHEET_META, type SheetKind, type SheetTable } from '../lib/sheets'
import { getSheetCsv, saveSheetCsv } from '../lib/storage'

export function SheetLog({
  sourceId,
  url,
  kind,
  importedAt,
  onImported,
}: {
  sourceId: string
  url: string
  kind: SheetKind
  importedAt?: string
  onImported?: (iso: string) => void
}) {
  const meta = SHEET_META[kind]
  const [table, setTable] = useState<SheetTable | null>(null)
  const [via, setVia] = useState<'google' | 'snapshot' | 'link' | ''>('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [rev, setRev] = useState(0)
  const [signedIn, setSignedIn] = useState(Boolean(googleAccessToken()))

  useEffect(() => subscribeGoogle(() => setSignedIn(Boolean(googleAccessToken()))), [])

  useEffect(() => {
    let gone = false
    setLoading(true)
    setError('')
    loadLog(sourceId, url)
      .then((result) => {
        if (gone) return
        if (!result) {
          setTable(null)
          setVia('')
          setError('')
          return
        }
        setTable(projectSheet(result.table, meta.columns))
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
  }, [sourceId, url, meta.columns, rev, signedIn])

  const rows = useMemo(() => (table ? filterRows(table, query) : []), [table, query])

  async function onFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    const parsed = parseCsv(text)
    if (!parsed.headers.length) {
      setError('That file did not look like a CSV.')
      return
    }
    await saveSheetCsv(sourceId, text)
    const iso = new Date().toISOString()
    onImported?.(iso)
    setRev((n) => n + 1)
  }

  const empty = !url.trim() && !importedAt && !table && !loading && !error

  return (
    <div className="stack">
      <div className="row">
        <label className="btn ghost file-btn">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              void onFile(file)
            }}
          />
        </label>
        <button className="btn ghost" type="button" onClick={() => setRev((n) => n + 1)}>
          Reload
        </button>
      </div>
      {via === 'google' ? <p className="faint">Live from your Google account. The sheet can stay private.</p> : null}
      {via === 'snapshot' && importedAt ? (
        <p className="faint">Private copy imported {new Date(importedAt).toLocaleString()}. Re-import to refresh.</p>
      ) : null}
      {via === 'snapshot' && !importedAt ? <p className="faint">Private CSV copy in this browser. Re-import to refresh.</p> : null}
      {via === 'link' ? (
        <p className="faint">Loaded from a public link. Prefer CSV import or Google sign-in so the sheet can stay restricted.</p>
      ) : null}
      {empty ? <p className="empty">{meta.empty}</p> : null}
      {loading ? <p className="muted">Loading sheet…</p> : null}
      {error && !loading ? <p className="muted">{error}</p> : null}
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

async function loadLog(
  sourceId: string,
  url: string,
): Promise<{ table: SheetTable; via: 'google' | 'snapshot' | 'link' } | null> {
  const token = googleAccessToken()
  const errors: string[] = []
  if (url.trim() && token) {
    try {
      return { table: await loadGoogleSheet(url, token), via: 'google' }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Google read failed.')
    }
  }
  const csv = await getSheetCsv(sourceId)
  if (csv) return { table: parseCsv(csv), via: 'snapshot' }
  if (url.trim()) {
    try {
      return { table: await loadPublicSheet(url), via: 'link' }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Link read failed.')
    }
  }
  if (!url.trim() && !errors.length) return null
  throw new Error(errors[0] || 'Import a CSV, or sign in with Google and paste the private sheet URL.')
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

export type SheetRef = { id: string; gid: string }

export type SheetTable = {
  headers: string[]
  rows: Record<string, string>[]
}

export const APP_COLUMNS = ['Date', 'Company', 'Role', 'Description'] as const
export const DSA_COLUMNS = ['Date', 'Problem', 'Difficulty', 'Topics', 'Notes'] as const

export type SheetKind = 'applications' | 'dsa'

export const SHEET_META: Record<
  SheetKind,
  { columns: readonly string[]; search: string }
> = {
  applications: {
    columns: APP_COLUMNS,
    search: 'Search company, role, or description',
  },
  dsa: {
    columns: DSA_COLUMNS,
    search: 'Search problem, topic, difficulty, or notes',
  },
}

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function parseSheetUrl(url: string): SheetRef | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  const idMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!idMatch?.[1]) return null
  const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/)
  return { id: idMatch[1], gid: gidMatch?.[1] ?? '0' }
}

export function parseCsv(text: string): SheetTable {
  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      if (row.some((c) => c.trim())) rows.push(row)
      row = []
      cell = ''
    } else if (ch !== '\r') {
      cell += ch
    }
  }
  if (cell.length || row.length) {
    row.push(cell)
    if (row.some((c) => c.trim())) rows.push(row)
  }
  const rawHeaders = rows[0] ?? []
  const headers = rawHeaders.map((h, i) => h.trim() || `Column ${i + 1}`)
  const body = rows.slice(1).map((r) => {
    const rec: Record<string, string> = {}
    headers.forEach((h, i) => {
      rec[h] = (r[i] ?? '').trim()
    })
    return rec
  })
  return { headers, rows: body }
}

export function parseGrid(values: string[][]): SheetTable {
  const rawHeaders = values[0] ?? []
  const headers = rawHeaders.map((h, i) => String(h ?? '').trim() || `Column ${i + 1}`)
  const body = values.slice(1).map((r) => {
    const rec: Record<string, string> = {}
    headers.forEach((h, i) => {
      rec[h] = String(r?.[i] ?? '').trim()
    })
    return rec
  })
  return { headers, rows: body }
}

export async function loadPublicSheet(url: string): Promise<SheetTable> {
  const ref = parseSheetUrl(url)
  if (!ref) throw new Error('Paste a Google Sheets link (the full URL from the address bar).')

  const paths = [
    `/sheet-csv/${ref.id}/${ref.gid}`,
    `https://docs.google.com/spreadsheets/d/${ref.id}/export?format=csv&gid=${ref.gid}`,
  ]

  let last = 'Could not load the sheet.'
  for (const path of paths) {
    try {
      const res = await fetch(path)
      if (!res.ok) {
        last = `Sheet request failed (${res.status}). For a private sheet, sign in with Google.`
        continue
      }
      const text = await res.text()
      if (text.trim().startsWith('<')) {
        last = 'This sheet is private. Sign in with Google to read it live.'
        continue
      }
      return parseCsv(text)
    } catch {
      last = 'Network error loading the sheet.'
    }
  }
  throw new Error(last)
}

/** @deprecated use loadPublicSheet */
export const loadSheet = loadPublicSheet

export function projectSheet(table: SheetTable, columns: readonly string[]): SheetTable {
  const lookup = new Map(table.headers.map((h) => [normHeader(h), h]))
  const resolved = columns.map((col) => ({
    col,
    source: lookup.get(normHeader(col)),
  }))
  const rows = table.rows.map((row) => {
    const next: Record<string, string> = {}
    for (const { col, source } of resolved) {
      next[col] = source ? (row[source] ?? '').trim() : ''
    }
    return next
  })
  return {
    headers: [...columns],
    rows: rows.filter((row) => Object.values(row).some((v) => v)),
  }
}

export function filterRows(table: SheetTable, query: string): Record<string, string>[] {
  const q = query.trim().toLowerCase()
  const rows = [...table.rows].sort((a, b) => dateKey(b.Date ?? b.date ?? '') - dateKey(a.Date ?? a.date ?? ''))
  if (!q) return rows
  return rows.filter((row) => Object.values(row).some((v) => v.toLowerCase().includes(q)))
}

function dateKey(value: string): number {
  const t = Date.parse(value)
  return Number.isNaN(t) ? 0 : t
}

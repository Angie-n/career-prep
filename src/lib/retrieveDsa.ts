import type { DsaRetrievedItem, NamedSheet } from './types'
import { filterRows, type SheetTable } from './sheets'
import { loadSheetLog } from './loadSheetLog'

/** How often an in-progress DSA block re-reads tracker sheets. */
export const DSA_TRACKER_POLL_MS = 30_000

function normalizeText(v: string | undefined): string {
  return (v ?? '').trim()
}

/** Keep session-only fields (solved, timeSec, id) when sheet rows refresh. */
export function mergeDsaRetrieved(
  previous: DsaRetrievedItem[],
  next: DsaRetrievedItem[],
): DsaRetrievedItem[] {
  const byProblem = new Map(previous.map((p) => [p.problem.toLowerCase(), p]))
  return next.map((n) => {
    const old = byProblem.get(n.problem.toLowerCase())
    if (!old) return n
    return {
      ...n,
      id: old.id ?? n.id,
      solved: old.solved,
      timeSec: old.timeSec,
    }
  })
}

function sameDsaRetrieved(a: DsaRetrievedItem[], b: DsaRetrievedItem[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.problem !== y.problem ||
      x.difficulty !== y.difficulty ||
      x.topics !== y.topics ||
      x.notes !== y.notes ||
      x.sheetId !== y.sheetId ||
      x.sheetName !== y.sheetName ||
      x.id !== y.id ||
      x.solved !== y.solved ||
      x.timeSec !== y.timeSec
    ) {
      return false
    }
  }
  return true
}

export async function retrieveDsaFromTrackers(
  trackers: NamedSheet[],
  query: string,
  opts?: { limit?: number },
): Promise<DsaRetrievedItem[]> {
  const limit = opts?.limit ?? 25
  const q = query.trim()

  const out: DsaRetrievedItem[] = []
  const seen = new Set<string>()

  for (const tracker of trackers) {
    if (out.length >= limit) break
    if (!tracker.id) continue

    let table: SheetTable | null = null
    try {
      const loaded = await loadSheetLog(tracker.url, 'dsa')
      table = loaded?.table ?? null
    } catch {
      table = null
    }

    if (!table) continue
    const rows = filterRows(table, q)
    for (const row of rows) {
      const problem = normalizeText(row.Problem)
      if (!problem) continue
      const key = problem.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      out.push({
        problem,
        difficulty: normalizeText(row.Difficulty),
        topics: normalizeText(row.Topics),
        notes: normalizeText(row.Notes),
        sheetId: tracker.id,
        sheetName: tracker.name,
      })
      if (out.length >= limit) return out
    }
  }

  return out
}

/** True when merged rows differ from the previous snapshot (avoids noisy store writes). */
export function dsaRetrievedChanged(previous: DsaRetrievedItem[], next: DsaRetrievedItem[]): boolean {
  return !sameDsaRetrieved(previous, next)
}


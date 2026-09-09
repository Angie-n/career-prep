import type { DsaRetrievedItem, NamedSheet } from './types'
import { filterRows, type SheetTable } from './sheets'
import { loadSheetLog } from './loadSheetLog'

function normalizeText(v: string | undefined): string {
  return (v ?? '').trim()
}

export async function retrieveDsaFromTrackers(
  trackers: NamedSheet[],
  query: string,
  opts?: { limit?: number },
): Promise<DsaRetrievedItem[]> {
  const limit = opts?.limit ?? 5
  const q = query.trim()

  const out: DsaRetrievedItem[] = []
  const seen = new Set<string>()

  for (const tracker of trackers) {
    if (!out.length || out.length < limit) {
      // continue below
    } else {
      break
    }

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
      })
      if (out.length >= limit) return out
    }
  }

  return out
}


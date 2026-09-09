import { loadGoogleSheet } from './googleSheets'
import { googleAccessToken } from './googleAuth'
import { loadPublicSheet, projectSheet, SHEET_META, type SheetKind, type SheetTable } from './sheets'

export type SheetLogVia = 'google' | 'link'

export async function loadSheetLog(
  url: string,
  kind: SheetKind,
): Promise<{ table: SheetTable; via: SheetLogVia } | null> {
  const meta = SHEET_META[kind]
  const token = googleAccessToken()
  const errors: string[] = []

  if (url.trim() && token) {
    try {
      const table = await loadGoogleSheet(url, token)
      return { table: projectSheet(table, meta.columns), via: 'google' }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Google read failed.')
    }
  }

  if (url.trim()) {
    try {
      const table = await loadPublicSheet(url)
      return { table: projectSheet(table, meta.columns), via: 'link' }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : 'Link read failed.')
    }
  }

  if (!url.trim() && !errors.length) return null
  throw new Error(errors[0] || 'Could not load sheet. Sign in with Google for a private sheet, or use a public sheet URL.')
}

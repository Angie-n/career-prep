import { parseGrid, parseSheetUrl, type SheetTable } from './sheets'
import { googleAccessToken } from './googleAuth'

type SpreadsheetMeta = {
  sheets?: { properties?: { sheetId?: number; title?: string } }[]
}

async function sheetTabTitle(
  spreadsheetId: string,
  gid: string,
  accessToken: string,
): Promise<string> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (metaRes.status === 401 || metaRes.status === 403) {
    throw new Error('Google access expired or was denied. Sign in again.')
  }
  if (!metaRes.ok) throw new Error(`Could not open the spreadsheet (${metaRes.status}).`)
  const meta = (await metaRes.json()) as SpreadsheetMeta
  const tabs = meta.sheets ?? []
  const gidNum = Number(gid)
  const tab =
    tabs.find((s) => s.properties?.sheetId === gidNum) ??
    tabs.find((s) => s.properties?.title) ??
    tabs[0]
  const title = tab?.properties?.title
  if (!title) throw new Error('No tabs found on that spreadsheet.')
  return title
}

export async function loadGoogleSheet(url: string, accessToken = googleAccessToken()): Promise<SheetTable> {
  if (!accessToken) throw new Error('Sign in with Google to read a private sheet.')
  const ref = parseSheetUrl(url)
  if (!ref) throw new Error('Paste a Google Sheets link (the full URL from the address bar).')

  const title = await sheetTabTitle(ref.id, ref.gid, accessToken)
  const range = encodeURIComponent(title)
  const valuesRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ref.id}/values/${range}?valueRenderOption=FORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!valuesRes.ok) throw new Error(`Could not read sheet values (${valuesRes.status}).`)
  const body = (await valuesRes.json()) as { values?: string[][] }
  return parseGrid(body.values ?? [])
}

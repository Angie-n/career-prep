import { useEffect, useState } from 'react'
import { googleAccessToken, subscribeGoogle } from './googleAuth'
import { countSheetRows } from './insights'
import { loadSheetLog } from './loadSheetLog'
import type { AppState } from './types'

const POLL_MS = 60_000

export type LifetimeLoggedStats = {
  applicationsSubmitted: number
  dsaProblemsSolved: number
  loading: boolean
}

/** Count all-time applications / DSA rows from configured tracker sheets. */
export function useLifetimeLoggedStats(sheets: AppState['sheets']): LifetimeLoggedStats {
  const [applicationsSubmitted, setApplicationsSubmitted] = useState(0)
  const [dsaProblemsSolved, setDsaProblemsSolved] = useState(0)
  const [loading, setLoading] = useState(false)
  const [signedIn, setSignedIn] = useState(Boolean(googleAccessToken()))

  const appsUrl = sheets.applications.url
  const dsaKey = sheets.dsa.map((s) => `${s.id}:${s.url}`).join('|')

  useEffect(() => subscribeGoogle(() => setSignedIn(Boolean(googleAccessToken()))), [])

  useEffect(() => {
    let gone = false
    let timer: number | undefined
    const dsaUrls = sheets.dsa.map((s) => s.url.trim()).filter(Boolean)

    async function load() {
      const hasApps = Boolean(appsUrl.trim())
      if (!hasApps && !dsaUrls.length) {
        if (!gone) {
          setApplicationsSubmitted(0)
          setDsaProblemsSolved(0)
          setLoading(false)
        }
        return
      }

      if (!gone) setLoading(true)

      let apps = 0
      let dsa = 0

      if (hasApps) {
        try {
          const loaded = await loadSheetLog(appsUrl, 'applications')
          if (loaded) apps = countSheetRows(loaded.table.rows)
        } catch {
          apps = 0
        }
      }

      for (const url of dsaUrls) {
        try {
          const loaded = await loadSheetLog(url, 'dsa')
          if (loaded) dsa += countSheetRows(loaded.table.rows)
        } catch {
          /* skip failed tracker */
        }
      }

      if (!gone) {
        setApplicationsSubmitted(apps)
        setDsaProblemsSolved(dsa)
        setLoading(false)
      }
    }

    void load()
    timer = window.setInterval(() => void load(), POLL_MS)
    const onFocus = () => void load()
    window.addEventListener('focus', onFocus)

    return () => {
      gone = true
      if (timer) window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [appsUrl, dsaKey, signedIn])

  return { applicationsSubmitted, dsaProblemsSolved, loading }
}

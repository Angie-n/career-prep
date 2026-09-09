import type { DsaRetrievedItem } from './types'

export type DsaDifficultyBucket = 'easy' | 'medium' | 'hard'

export function dsaDifficultyBucket(value: string): DsaDifficultyBucket | null {
  const v = value.trim().toLowerCase()
  if (v.startsWith('easy')) return 'easy'
  if (v.startsWith('med')) return 'medium'
  if (v.startsWith('hard')) return 'hard'
  return null
}

/** Stats derived only from tracker retrievals (no manual session adds). */
export function computeDsaStats(entries: DsaRetrievedItem[]) {
  let easysSolved = 0
  let mediumsSolved = 0
  let hardSolved = 0
  let sumSec = 0
  let nWithTime = 0
  for (const e of entries) {
    const b = dsaDifficultyBucket(e.difficulty)
    if (b === 'easy') easysSolved += 1
    else if (b === 'medium') mediumsSolved += 1
    else if (b === 'hard') hardSolved += 1
    const t = e.timeSec
    if (typeof t === 'number' && Number.isFinite(t) && t >= 0) {
      sumSec += t
      nWithTime += 1
    }
  }
  const avgSecPerQuestion = nWithTime ? sumSec / nWithTime : null
  return { easysSolved, mediumsSolved, hardSolved, avgSecPerQuestion, nSolved: entries.length }
}

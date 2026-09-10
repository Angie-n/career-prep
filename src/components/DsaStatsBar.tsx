import { formatClock } from '../lib/ids'
import { computeDsaStats } from '../lib/dsaStats'
import type { DsaRetrievedItem } from '../lib/types'

export function DsaStatsBar({
  entries,
  label = 'Session stats',
}: {
  entries: DsaRetrievedItem[]
  label?: string
}) {
  const stats = computeDsaStats(entries)

  return (
    <section className="dsa-stats-bar" aria-label={label}>
      <div className="dsa-stat-grid">
        <div className="dsa-stat-item">
          <p className="kicker">Easys</p>
          <strong className="dsa-stat-value">{stats.easysSolved}</strong>
        </div>
        <div className="dsa-stat-item">
          <p className="kicker">Mediums</p>
          <strong className="dsa-stat-value">{stats.mediumsSolved}</strong>
        </div>
        <div className="dsa-stat-item">
          <p className="kicker">Hards</p>
          <strong className="dsa-stat-value">{stats.hardSolved}</strong>
        </div>
        <div className="dsa-stat-item">
          <p className="kicker">Average time</p>
          <strong className="dsa-stat-value">
            {stats.avgSecPerQuestion != null ? formatClock(stats.avgSecPerQuestion) : '—'}
          </strong>
        </div>
      </div>
    </section>
  )
}

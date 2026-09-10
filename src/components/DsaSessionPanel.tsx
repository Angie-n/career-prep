import { DsaStatsBar } from './DsaStatsBar'
import { dsaDifficultyBucket } from '../lib/dsaStats'
import { formatClock } from '../lib/ids'
import type { DsaRetrievedItem } from '../lib/types'

export function DsaSessionPanel({
  entries,
  notes,
  onNotes,
}: {
  entries: DsaRetrievedItem[]
  notes: string
  onNotes: (value: string) => void
}) {
  return (
    <div className="dsa-session">
      <DsaStatsBar entries={entries} label="This session" />

      <div className="dsa-session-columns">
        <div className="dsa-session-col dsa-session-log">
          <div className="dsa-col-head">
            <h2 className="dsa-col-heading">From your tracker</h2>
            <p className="muted dsa-log-hint">
              Live from all of your trackers — refreshes while this block runs.
            </p>
          </div>
          <div className="dsa-col-scroll">
            {entries.length ? (
              <div className="dsa-log-list">
                {entries.map((r, i) => {
                  const bucket = dsaDifficultyBucket(r.difficulty)
                  return (
                    <section className="cue dsa-log-cue" key={r.id ?? `${r.problem}-${i}`}>
                      <div className="row" style={{ justifyContent: 'space-between' }}>
                        <b>Problem {i + 1}</b>
                        {r.difficulty ? (
                          <span className={`dsa-diff-chip${bucket ? ` dsa-diff-${bucket}` : ''}`}>
                            {r.difficulty}
                          </span>
                        ) : null}
                      </div>
                      <p className="dsa-log-problem">{r.problem}</p>
                      {r.topics ? (
                        <p className="muted" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                          {r.topics}
                        </p>
                      ) : null}
                      {r.notes ? (
                        <p className="faint" style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>
                          {r.notes}
                        </p>
                      ) : null}
                      {typeof r.timeSec === 'number' ? (
                        <p className="muted" style={{ marginTop: 8 }}>
                          Time: {formatClock(r.timeSec)}
                        </p>
                      ) : null}
                    </section>
                  )
                })}
              </div>
            ) : (
              <p className="muted">No tracker rows were retrieved for this block.</p>
            )}
          </div>
        </div>

        <div className="dsa-session-col dsa-session-notes-col">
          <div className="dsa-col-head">
            <h2 className="dsa-col-heading">Session notes</h2>
          </div>
          <label className="field dsa-notes-field">
            <textarea
              className="notes dsa-session-notes-area"
              placeholder="Scratchpad for this block — stays local."
              value={notes}
              onChange={(e) => onNotes(e.target.value)}
            />
          </label>
        </div>
      </div>
    </div>
  )
}

import { Recorder } from './Recorder'
import type { SessionAnswer } from '../lib/types'

export function QuestionRecap({
  answer,
  index,
  readOnly,
  onChange,
}: {
  answer: SessionAnswer
  index: number
  readOnly?: boolean
  onChange?: (next: { transcript?: string; audioId?: string }) => void
}) {
  const hasTake = Boolean(answer.audioId || answer.transcript)

  return (
    <section className="card">
      <p className="kicker">Question {index + 1}</p>
      <h3>{answer.prompt}</h3>
      {answer.draftNotes ? (
        <>
          <p className="kicker" style={{ marginTop: 12 }}>
            Draft anchors
          </p>
          <p className="muted" style={{ whiteSpace: 'pre-wrap' }}>
            {answer.draftNotes}
          </p>
        </>
      ) : null}
      {hasTake || !readOnly ? (
        <Recorder
          audioId={answer.audioId}
          transcript={answer.transcript}
          readOnly={readOnly}
          onChange={onChange}
        />
      ) : (
        <p className="faint" style={{ marginTop: 12 }}>
          No recording or transcript for this one.
        </p>
      )}
    </section>
  )
}

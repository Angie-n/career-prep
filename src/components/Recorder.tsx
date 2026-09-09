import { useEffect, useRef, useState } from 'react'
import { getAudio, saveAudio } from '../lib/storage'
import { recordAudio, speechAvailable, startLiveTranscript } from '../lib/audio'
import { uid } from '../lib/ids'

export function Recorder({
  audioId,
  transcript,
  onChange,
  readOnly = false,
}: {
  audioId?: string
  transcript: string
  onChange?: (next: { audioId?: string; transcript: string }) => void
  readOnly?: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [interim, setInterim] = useState('')
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState('')
  const stopRef = useRef<null | (() => Promise<{ blob: Blob; mime: string }>)>(null)
  const liveStop = useRef<null | (() => void)>(null)
  const urlRef = useRef<string | undefined>(undefined)

  function replaceUrl(next?: string) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = next
    setUrl(next)
  }

  useEffect(() => {
    let gone = false
    if (!audioId) {
      replaceUrl(undefined)
      return
    }
    getAudio(audioId).then((blob) => {
      if (gone || !blob) return
      replaceUrl(URL.createObjectURL(blob))
    })
    return () => {
      gone = true
    }
  }, [audioId])

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  async function toggle() {
    setError('')
    if (recording) {
      liveStop.current?.()
      liveStop.current = null
      const stop = stopRef.current
      stopRef.current = null
      setRecording(false)
      if (!stop) return
      const { blob } = await stop()
      const id = uid()
      await saveAudio(id, blob)
      replaceUrl(URL.createObjectURL(blob))
      onChange?.({ audioId: id, transcript })
      return
    }
    try {
      const rec = await recordAudio()
      stopRef.current = rec.stop
      setRecording(true)
      if (speechAvailable()) {
        liveStop.current = startLiveTranscript((finalText, live) => {
          setInterim(live)
          if (finalText) onChange?.({ audioId, transcript: finalText })
        })
      }
    } catch {
      setError('Microphone permission is needed to record. You can still speak with the timer.')
    }
  }

  return (
    <div className="rec-box">
      <div className="row">
        {recording ? <span className="pulse" /> : null}
        {readOnly ? null : (
          <button className="btn subtle" type="button" onClick={() => void toggle()}>
            {recording ? 'Stop recording' : audioId ? 'Re-record' : 'Record answer'}
          </button>
        )}
        <span className="muted">
          {readOnly
            ? 'Playback and transcript from this session.'
            : 'Optional. A transcript is a draft you can paste into another tool for feedback.'}
        </span>
      </div>
      {error ? <p className="muted">{error}</p> : null}
      {(transcript || interim) && (
        <p className="transcript">
          {transcript}
          {interim ? <em> {interim}</em> : null}
        </p>
      )}
      {transcript ? (
        <button
          className="btn ghost"
          type="button"
          onClick={() => void navigator.clipboard.writeText(transcript)}
        >
          Copy transcript
        </button>
      ) : readOnly ? null : speechAvailable() ? (
        <p className="faint">Live transcription uses your browser’s speech engine when available.</p>
      ) : (
        <p className="faint">This browser may not transcribe live. Recording still works.</p>
      )}
      {url && !recording ? <audio key={url} controls src={url} /> : null}
    </div>
  )
}

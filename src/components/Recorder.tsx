import { useEffect, useRef, useState } from 'react'
import { getAudio, saveAudio } from '../lib/storage'
import { recordMedia, speechAvailable, startLiveTranscript, type MediaKind } from '../lib/audio'
import { uid } from '../lib/ids'

function CamIcon() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <rect x="8" y="18" width="42" height="38" rx="8" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M50 29l18-10v42L50 51" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="29" cy="37" r="8" fill="none" stroke="currentColor" strokeWidth="4" />
    </svg>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <rect x="32" y="12" width="16" height="32" rx="8" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M22 36c0 11 7 18 18 18s18-7 18-18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M40 54v16M28 70h24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function Recorder({
  audioId,
  mediaKind,
  transcript,
  onChange,
  readOnly = false,
  required = false,
  disabled = false,
}: {
  audioId?: string
  mediaKind?: MediaKind
  transcript: string
  onChange?: (next: {
    audioId?: string
    mediaKind?: MediaKind
    transcript: string
  }) => void
  readOnly?: boolean
  /** Optional; kept for compatibility but no longer blocks session progression. */
  required?: boolean
  disabled?: boolean
}) {
  const [recording, setRecording] = useState(false)
  const [liveKind, setLiveKind] = useState<MediaKind | undefined>()
  const [interim, setInterim] = useState('')
  const [url, setUrl] = useState<string>()
  const [blobKind, setBlobKind] = useState<MediaKind | undefined>(mediaKind)
  const [preferredKind, setPreferredKind] = useState<MediaKind>(mediaKind ?? 'video')
  const [selectedMode, setSelectedMode] = useState<MediaKind | null>(null)
  const [error, setError] = useState('')
  const stopRef = useRef<null | (() => Promise<{ blob: Blob; mime: string; kind: MediaKind }>)>(
    null,
  )
  const liveStop = useRef<null | (() => void)>(null)
  const urlRef = useRef<string | undefined>(undefined)
  const previewRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function replaceUrl(next?: string) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = next
    setUrl(next)
  }

  useEffect(() => {
    setBlobKind(mediaKind)
  }, [mediaKind])

  useEffect(() => {
    let gone = false
    if (!audioId) {
      replaceUrl(undefined)
      return
    }
    getAudio(audioId).then((blob) => {
      if (gone || !blob) return
      const inferred: MediaKind =
        mediaKind ?? (blob.type.startsWith('video/') ? 'video' : 'audio')
      setBlobKind(inferred)
      replaceUrl(URL.createObjectURL(blob))
    })
    return () => {
      gone = true
    }
  }, [audioId, mediaKind])

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const el = previewRef.current
    const stream = streamRef.current
    if (!el || !stream || !recording || liveKind !== 'video') return
    el.srcObject = stream
    void el.play().catch(() => {})
    return () => {
      el.srcObject = null
    }
  }, [recording, liveKind])

  async function toggle(kindOverride?: MediaKind) {
    if (disabled) return
    setError('')
    if (recording) {
      liveStop.current?.()
      liveStop.current = null
      const stop = stopRef.current
      stopRef.current = null
      setRecording(false)
      setLiveKind(undefined)
      streamRef.current = null
      if (!stop) return
      const { blob, kind } = await stop()
      const id = uid()
      await saveAudio(id, blob)
      setBlobKind(kind)
      setPreferredKind(kind)
      replaceUrl(URL.createObjectURL(blob))
      onChange?.({ audioId: id, mediaKind: kind, transcript })
      return
    }
    try {
      const mode = kindOverride ?? selectedMode ?? preferredKind
      const rec = await recordMedia(mode === 'video')
      stopRef.current = rec.stop
      streamRef.current = rec.stream
      setLiveKind(rec.kind)
      setPreferredKind(rec.kind)
      setSelectedMode(rec.kind)
      setRecording(true)
      if (speechAvailable()) {
        liveStop.current = startLiveTranscript((finalText, live) => {
          setInterim(live)
          if (finalText) onChange?.({ audioId, mediaKind: blobKind ?? mediaKind, transcript: finalText })
        })
      }
    } catch {
      setError(
        required
          ? 'Camera or microphone permission is needed to record your delivery.'
          : 'Microphone permission is needed to record. You can still speak with the timer.',
      )
    }
  }

  async function exportCurrentTake() {
    if (!audioId) {
      if (!transcript.trim()) return
      const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' })
      const urlToDownload = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = urlToDownload
      link.download = 'transcript.txt'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(urlToDownload)
      return
    }
    const blob = await getAudio(audioId)
    if (!blob) return
    const urlToDownload = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = urlToDownload
    link.download = `take-${Date.now()}.${blob.type.includes('video') ? 'webm' : 'webm'}`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(urlToDownload)
  }

  function CopyIcon() {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9 8.5A2.5 2.5 0 0 1 11.5 6H17a2 2 0 0 1 2 2v5.5A2.5 2.5 0 0 1 16.5 16H11.5A2.5 2.5 0 0 1 9 13.5v-5Zm-4 4A2.5 2.5 0 0 1 7.5 10H9v3.5A3.5 3.5 0 0 0 12.5 17H16v.5A2.5 2.5 0 0 1 13.5 20H7.5A2.5 2.5 0 0 1 5 17.5v-4.5Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  function ExportIcon() {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 4v8.5m0 0 3.5-3.5M12 12.5 8.5 9M5 17.5v1.2A1.3 1.3 0 0 0 6.3 20h11.4a1.3 1.3 0 0 0 1.3-1.3v-1.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  const playbackKind = blobKind ?? mediaKind ?? 'audio'
  const hasTake = Boolean(audioId)
  const showModeChoice = !readOnly && !recording && !selectedMode && !disabled
  const showReadyState = !readOnly && !recording && selectedMode && !disabled

  return (
    <div className="rec-box">
      {!readOnly && !recording && selectedMode ? (
        <button className="rec-back-link" type="button" onClick={() => setSelectedMode(null)}>
          ← Back to recording options
        </button>
      ) : null}
      {showModeChoice ? (
        <div className="rec-mode-grid" aria-label="Choose how to record your answer">
          <button
            type="button"
            className={`rec-mode rec-mode-video${preferredKind === 'video' ? ' is-selected' : ''}`}
            onClick={() => {
              setPreferredKind('video')
              setSelectedMode('video')
            }}
          >
            <span className="rec-mode-icon" aria-hidden="true">
              <CamIcon />
            </span>
            <span className="rec-mode-copy">
              <strong>Video Record</strong>
              <span>Face + delivery</span>
            </span>
          </button>
          <button
            type="button"
            className={`rec-mode rec-mode-audio${preferredKind === 'audio' ? ' is-selected' : ''}`}
            onClick={() => {
              setPreferredKind('audio')
              setSelectedMode('audio')
            }}
          >
            <span className="rec-mode-icon" aria-hidden="true">
              <MicIcon />
            </span>
            <span className="rec-mode-copy">
              <strong>Voice Record</strong>
              <span>Just your answer</span>
            </span>
          </button>
        </div>
      ) : null}
      <div className="row">
        {recording ? <span className="pulse" /> : null}
        {readOnly ? null : (
          <>
            {recording ? (
              <button className="btn subtle" type="button" onClick={() => void toggle()}>
                Stop recording
              </button>
            ) : showReadyState ? (
              <button className="btn subtle" type="button" onClick={() => void toggle(selectedMode ?? preferredKind)}>
                Start recording
              </button>
            ) : hasTake ? (
              <button className="btn subtle" type="button" onClick={() => setSelectedMode(preferredKind)}>
                Record again
              </button>
            ) : null}
          </>
        )}
        <span className="muted">
          {readOnly
            ? 'Playback and transcript from this session.'
            : disabled
              ? 'Time is up. Your current work is saved — move on to the next step.'
              : null }
        </span>
      </div>
      {!readOnly ? (
        <p className="faint rec-temp-note">
          Temporary self-reflection only. Recordings and video disappear when you leave or finish this
          session — export to keep a copy.
        </p>
      ) : null}
      {error ? <p className="muted">{error}</p> : null}
      {recording && liveKind === 'video' ? (
        <video
          ref={previewRef}
          className="rec-preview"
          muted
          playsInline
          autoPlay
          aria-label="Camera preview"
        />
      ) : null}
      {recording && liveKind === 'audio' ? (
        <p className="faint">Recording audio only — no camera on this take.</p>
      ) : null}
      {url && !recording ? (
        <div className="rec-media-row">
          <div className="rec-player-wrap">
            {playbackKind === 'video' ? (
              <video key={url} className="rec-playback" controls playsInline src={url} />
            ) : (
              <audio key={url} controls src={url} />
            )}
          </div>
          <button
            className="rec-export-btn"
            type="button"
            onClick={() => void exportCurrentTake()}
            aria-label="Export take"
            title="Export take"
          >
            <ExportIcon />
          </button>
        </div>
      ) : null}
      {(transcript || interim) && (
        <div className="transcript-box">
          <div className="transcript-header">
            <span className="transcript-label">Transcript</span>
            {transcript ? (
              <button
                className="rec-copy-btn"
                type="button"
                onClick={() => void navigator.clipboard.writeText(transcript)}
                aria-label="Copy transcript"
                title="Copy transcript"
              >
                <CopyIcon />
              </button>
            ) : null}
          </div>
          <p className="transcript">
            {transcript}
            {interim ? <em> {interim}</em> : null}
          </p>
        </div>
      )}
      {transcript ? null : readOnly ? null : speechAvailable() ? (
        <p className="faint">Record for a live transcription that uses your browser’s speech engine when available.</p>
      ) : (
        <p className="faint">This browser may not transcribe live. Recording still works.</p>
      )}
      {!transcript && hasTake && !readOnly ? null : null}
    </div>
  )
}

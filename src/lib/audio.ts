import type { MediaKind } from './types'

export type TranscriptHandler = (text: string, interim: string) => void
export type { MediaKind }

type Rec = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((ev: { resultIndex: number; results: SpeechResultList }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechResultList = {
  length: number
  [index: number]: { isFinal: boolean; 0: { transcript: string } }
}

function recognitionCtor(): (new () => Rec) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => Rec
    webkitSpeechRecognition?: new () => Rec
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function speechAvailable(): boolean {
  return recognitionCtor() !== null
}

export function startLiveTranscript(onUpdate: TranscriptHandler): () => void {
  const Ctor = recognitionCtor()
  if (!Ctor) return () => {}

  const rec = new Ctor()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = 'en-US'
  let stopped = false

  rec.onresult = (ev) => {
    let finalText = ''
    let interim = ''
    for (let i = 0; i < ev.results.length; i++) {
      const piece = ev.results[i][0].transcript
      if (ev.results[i].isFinal) finalText += `${piece} `
      else interim += piece
    }
    onUpdate(finalText.trim(), interim)
  }
  rec.onend = () => {
    if (!stopped) {
      try {
        rec.start()
      } catch {
        /* already started */
      }
    }
  }
  rec.start()
  return () => {
    stopped = true
    rec.onend = null
    rec.stop()
  }
}

function pickMime(kind: MediaKind): string {
  if (kind === 'video') {
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
      return 'video/webm;codecs=vp9,opus'
    }
    if (MediaRecorder.isTypeSupported('video/webm')) return 'video/webm'
    return ''
  }
  return MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
}

async function openStream(preferVideo: boolean): Promise<{ stream: MediaStream; kind: MediaKind }> {
  if (preferVideo) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      return { stream, kind: 'video' }
    } catch {
      // Camera denied/unavailable — still practice with audio.
    }
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  return { stream, kind: 'audio' }
}

/** Prefer camera+mic; fall back to audio-only when video is unavailable. */
export async function recordMedia(preferVideo = true): Promise<{
  stream: MediaStream
  kind: MediaKind
  stop: () => Promise<{ blob: Blob; mime: string; kind: MediaKind }>
}> {
  const { stream, kind } = await openStream(preferVideo)
  const mime = pickMime(kind)
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  recorder.start()

  return {
    stream,
    kind,
    stop: () =>
      new Promise((resolve) => {
        const finish = () => {
          stream.getTracks().forEach((t) => t.stop())
          const type =
            recorder.mimeType || (kind === 'video' ? 'video/webm' : 'audio/webm')
          resolve({ blob: new Blob(chunks, { type }), mime: type, kind })
        }
        recorder.onstop = finish
        if (recorder.state !== 'inactive') recorder.stop()
        else finish()
      }),
  }
}

/** @deprecated Prefer recordMedia — kept for call sites that only need audio. */
export async function recordAudio(): Promise<{
  stop: () => Promise<{ blob: Blob; mime: string }>
}> {
  const rec = await recordMedia(false)
  return {
    stop: async () => {
      const { blob, mime } = await rec.stop()
      return { blob, mime }
    },
  }
}

export function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 660
    gain.gain.value = 0.04
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12)
  } catch {
    /* ignore */
  }
}

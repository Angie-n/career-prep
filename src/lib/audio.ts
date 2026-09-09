export type TranscriptHandler = (text: string, interim: string) => void

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

export async function recordAudio(): Promise<{
  stop: () => Promise<{ blob: Blob; mime: string }>
}> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : ''
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data)
  }
  recorder.start()

  return {
    stop: () =>
      new Promise((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop())
          const type = recorder.mimeType || 'audio/webm'
          resolve({ blob: new Blob(chunks, { type }), mime: type })
        }
        if (recorder.state !== 'inactive') recorder.stop()
        else {
          stream.getTracks().forEach((t) => t.stop())
          resolve({ blob: new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }), mime: recorder.mimeType })
        }
      }),
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

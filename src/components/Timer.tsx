import { useEffect, useRef, useState } from 'react'
import { formatClock } from '../lib/ids'
import { beep } from '../lib/audio'

export function Timer({
  elapsedSec,
  startedAt,
  targetSec,
  running,
  onExpire,
  onAdjustTarget,
  variant = 'compact',
}: {
  /** Frozen elapsed seconds (used when paused or without startedAt). */
  elapsedSec: number
  /** Wall-clock phase start (epoch ms). When set and running, elapsed is derived from now. */
  startedAt?: number
  /** Planned / allocated duration for this phase. */
  targetSec: number
  running: boolean
  onExpire?: (expired: boolean) => void
  /** Called when user bumps ±1m so the parent can adjust the planned target. */
  onAdjustTarget?: (deltaSec: number) => void
  variant?: 'compact' | 'hero'
}) {
  const readElapsed = () => {
    if (startedAt != null && running) {
      return Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    }
    return Math.max(0, Math.floor(elapsedSec))
  }

  const [elapsed, setElapsed] = useState(readElapsed)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    setElapsed(readElapsed())
    expiredRef.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-sync when freeze/start/run inputs change
  }, [elapsedSec, startedAt, running])

  useEffect(() => {
    const pastTarget = targetSec > 0 && elapsed >= targetSec
    if (!pastTarget) {
      if (expiredRef.current) {
        expiredRef.current = false
        onExpireRef.current?.(false)
      }
      return
    }
    if (expiredRef.current) return
    expiredRef.current = true
    beep()
    onExpireRef.current?.(true)
  }, [elapsed, targetSec])

  useEffect(() => {
    if (!running) return
    const tick = () => setElapsed(readElapsed())
    tick()
    const t = window.setInterval(tick, 250)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick closes over latest startedAt/elapsedSec via deps
  }, [running, startedAt, elapsedSec])

  function bump(delta: number) {
    onAdjustTarget?.(delta)
  }

  const pastTarget = targetSec > 0 && elapsed >= targetSec
  const overSec = pastTarget ? elapsed - targetSec : 0
  const progress = targetSec > 0 ? Math.min(1, elapsed / targetSec) : 0
  const metaLabel = !running
    ? `Paused · ${formatClock(elapsed)} / ${formatClock(targetSec)}`
    : pastTarget
      ? `+${formatClock(overSec)} past goal`
      : `${formatClock(elapsed)} / ${formatClock(targetSec)}`

  const clock = (
    <div
      className={`timer${pastTarget && running ? ' over' : ''}${running ? '' : ' is-paused'}`}
      aria-live="polite"
    >
      {formatClock(elapsed)}
    </div>
  )

  const progressUi = (
    <div className="timer-progress-wrap">
      <div
        className={`timer-progress${pastTarget && running ? ' over' : ''}${running ? '' : ' is-paused'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={targetSec}
        aria-valuenow={Math.min(elapsed, targetSec)}
        aria-label="Progress toward planned time"
      >
        <div className="timer-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
      <p className={`timer-meta${pastTarget && running ? ' over' : ''}${running ? '' : ' is-paused'}`}>
        {metaLabel}
      </p>
    </div>
  )

  if (variant === 'hero') {
    return (
      <div className={`timer-hero${running ? '' : ' is-paused'}`}>
        <button className="btn ghost timer-hero-bump" type="button" onClick={() => bump(-60)}>
          −1m
        </button>
        {clock}
        <button className="btn ghost timer-hero-bump" type="button" onClick={() => bump(60)}>
          +1m
        </button>
        {progressUi}
      </div>
    )
  }

  return (
    <div className={`timer-box${running ? '' : ' is-paused'}`}>
      <button className="btn ghost" type="button" onClick={() => bump(-60)}>
        −1m
      </button>
      <div className="timer-box-main">
        {clock}
        {progressUi}
      </div>
      <button className="btn ghost" type="button" onClick={() => bump(60)}>
        +1m
      </button>
    </div>
  )
}

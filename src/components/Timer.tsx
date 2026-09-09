import { useEffect, useRef, useState } from 'react'
import { formatClock } from '../lib/ids'
import { beep } from '../lib/audio'

export function Timer({
  seconds,
  running,
  onExpire,
}: {
  seconds: number
  running: boolean
  onExpire?: (expired: boolean) => void
}) {
  const [left, setLeft] = useState(seconds)
  const expiredRef = useRef(false)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  useEffect(() => {
    setLeft(seconds)
    expiredRef.current = false
  }, [seconds])

  useEffect(() => {
    if (left > 0) {
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
  }, [left])

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => {
      setLeft((n) => (n <= 1 ? 0 : n - 1))
    }, 1000)
    return () => window.clearInterval(t)
  }, [running])

  function bump(delta: number) {
    setLeft((n) => Math.max(0, n + delta))
  }

  return (
    <div className="timer-box">
      <button className="btn ghost" type="button" onClick={() => bump(-60)}>
        −1m
      </button>
      <div className={left === 0 || left <= 15 ? 'timer warn' : 'timer'}>{formatClock(left)}</div>
      <button className="btn ghost" type="button" onClick={() => bump(60)}>
        +1m
      </button>
    </div>
  )
}

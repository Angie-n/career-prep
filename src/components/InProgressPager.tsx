import { useEffect, useState } from 'react'
import { ResumeSessionCard } from './ResumeSessionCard'
import { SESSION_META, type PracticeSession } from '../lib/types'

export function InProgressPager({
  sessions,
  headingLevel = 'h2',
}: {
  sessions: PracticeSession[]
  headingLevel?: 'h1' | 'h2'
}) {
  const [index, setIndex] = useState(0)
  const [slideDir, setSlideDir] = useState<0 | 1 | -1>(0)
  const [panelKey, setPanelKey] = useState(0)

  const safeIndex = sessions.length === 0 ? 0 : Math.min(index, sessions.length - 1)
  const current = sessions[safeIndex]

  useEffect(() => {
    if (index > sessions.length - 1) {
      setIndex(Math.max(0, sessions.length - 1))
    }
  }, [index, sessions.length])

  if (!current) return null
  if (sessions.length === 1) {
    return <ResumeSessionCard session={current} headingLevel={headingLevel} />
  }

  function select(nextIndex: number) {
    if (sessions.length < 2 || nextIndex === safeIndex) return
    const wrapped =
      nextIndex > safeIndex
        ? nextIndex - safeIndex <= sessions.length / 2
          ? 1
          : -1
        : safeIndex - nextIndex <= sessions.length / 2
          ? -1
          : 1
    setSlideDir(wrapped)
    setPanelKey((k) => k + 1)
    setIndex(nextIndex)
  }

  function go(delta: number) {
    select((safeIndex + delta + sessions.length) % sessions.length)
  }

  return (
    <div className="in-progress-pager has-pager">
      <button
        className="hero-action-chevron"
        type="button"
        aria-label="Previous in-progress session"
        onClick={() => go(-1)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M10.5 3.5 5.5 8l5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="hero-action-main">
        <div
          key={panelKey}
          className={`hero-action-panel${
            slideDir === 1 ? ' slide-next' : slideDir === -1 ? ' slide-prev' : ''
          }`}
        >
          <ResumeSessionCard session={current} headingLevel={headingLevel} />
        </div>
        <div className="hero-action-dots" role="tablist" aria-label="In-progress sessions">
          {sessions.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === safeIndex}
              aria-label={`In progress: ${SESSION_META[s.kind].title}`}
              className={`hero-action-dot${i === safeIndex ? ' is-active' : ''}`}
              onClick={() => select(i)}
            />
          ))}
        </div>
      </div>

      <button
        className="hero-action-chevron"
        type="button"
        aria-label="Next in-progress session"
        onClick={() => go(1)}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M5.5 3.5 10.5 8l-5 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}

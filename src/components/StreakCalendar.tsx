import { categoryStreak, goalMetWindow } from '../lib/insights'
import { todayKey } from '../lib/ids'
import { CATEGORY_LABEL, type Category } from '../lib/types'
import { useStore } from '../state/Store'

type Props = {
  category: Category
  /**
   * Full dashboard card, or a mini horizontal strip for category homes.
   * Compact is intentionally secondary — tiny fixed dots, not a full-width grid.
   */
  compact?: boolean
  days?: number
}

export function StreakCalendar({ category, compact = false, days = 28 }: Props) {
  const { state } = useStore()
  const current = categoryStreak(state, category)
  const max = Math.max(state.maxStreaks[category] ?? 0, current)
  const window = goalMetWindow(state, category, days)
  const today = todayKey()

  if (compact) {
    return (
      <aside className={`streak-mini cat-${category}`} aria-label={`${CATEGORY_LABEL[category]} streak`}>
        <p className="muted streak-mini-line">
          {current}d streak · max {max}
        </p>
        <div className="mini-cal-row" aria-hidden>
          {window.map(({ day, met }) => (
            <span
              key={day}
              className={`mini-cal-day${met ? ' met' : ''}${day === today ? ' today' : ''}`}
              title={day}
            />
          ))}
        </div>
      </aside>
    )
  }

  return (
    <section className={`card streak-card cat-${category}`}>
      <p className="kicker">{CATEGORY_LABEL[category]}</p>
      <div className="streak-nums">
        <div>
          <h2 className="streak-current">{current}</h2>
          <p className="muted">{current === 1 ? 'day streak' : 'days streak'}</p>
        </div>
        <div className="streak-max">
          <span className="streak-max-n">{max}</span>
          <span className="muted">max</span>
        </div>
      </div>
      <div className="mini-cal" role="img" aria-label={`Last ${days} days for ${CATEGORY_LABEL[category]}`}>
        {window.map(({ day, met }) => (
          <span
            key={day}
            className={`mini-cal-day${met ? ' met' : ''}${day === today ? ' today' : ''}`}
            title={`${day}${met ? ' · goal met' : ''}`}
          />
        ))}
      </div>
    </section>
  )
}

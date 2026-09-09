import { CATEGORY_BY_KIND, CATEGORY_LABEL, type Category } from '../lib/types'
import { minutesToday, sessionsOn } from '../lib/insights'
import { todayKey } from '../lib/ids'
import { useStore } from '../state/Store'
import { StreakCalendar } from './StreakCalendar'

export function CategoryGlance({ category }: { category: Category }) {
  const { state } = useStore()
  const have = minutesToday(state)[category]
  const goal = state.goals[category]
  const met = have >= goal
  const pct = Math.min(100, (have / Math.max(1, goal)) * 100)
  const todayCount = sessionsOn(state, todayKey()).filter((s) => CATEGORY_BY_KIND[s.kind] === category).length

  return (
    <section className={`card glance cat-${category}${met ? ' is-met' : ''}`}>
      <div className="glance-main">
        <p className="kicker">Today</p>
        <h2 className="goal-label">
          {Math.round(have)}m / {goal}m
        </h2>
        <div className={`bar${met ? ' is-full' : ''}`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        {met ? (
          <p className="glance-status">
            <span className="chip goal-met-chip">Goal met</span>
            <span className="muted">
              {todayCount === 1 ? '1 session today' : `${todayCount} sessions today`}
            </span>
          </p>
        ) : (
          <p className="muted">
            {todayCount === 1 ? '1 session today' : `${todayCount} sessions today`}
            {' · '}
            {CATEGORY_LABEL[category]}
          </p>
        )}
      </div>
      <StreakCalendar category={category} compact days={14} />
    </section>
  )
}

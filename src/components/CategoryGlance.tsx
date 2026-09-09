import { CATEGORY_BY_KIND, CATEGORY_LABEL, type Category } from '../lib/types'
import { minutesToday, sessionsOn } from '../lib/insights'
import { todayKey } from '../lib/ids'
import { useStore } from '../state/Store'
import { StreakCalendar } from './StreakCalendar'

export function CategoryGlance({ category }: { category: Category }) {
  const { state } = useStore()
  const have = minutesToday(state)[category]
  const goal = state.goals[category]
  const pct = Math.min(100, (have / Math.max(1, goal)) * 100)
  const todayCount = sessionsOn(state, todayKey()).filter((s) => CATEGORY_BY_KIND[s.kind] === category).length

  return (
    <section className={`card glance cat-${category}`}>
      <p className="kicker">Today</p>
      <h2>
        {Math.round(have)}m / {goal}m
      </h2>
      <div className="bar" style={{ marginTop: 12 }}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <p className="muted" style={{ marginTop: 10 }}>
        {todayCount === 1 ? '1 session today' : `${todayCount} sessions today`}
        {' · '}
        {CATEGORY_LABEL[category]}
      </p>
      <StreakCalendar category={category} compact days={21} />
    </section>
  )
}

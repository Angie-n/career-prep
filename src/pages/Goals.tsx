import { CATEGORIES, CATEGORY_BLURB, CATEGORY_LABEL } from '../lib/types'
import { useStore } from '../state/Store'

export function Goals() {
  const { state, dispatch } = useStore()

  return (
    <div className="stack">
      <div className="page-head">
        <p className="kicker">Goals</p>
        <h1>Set the bar</h1>
        <p className="lead">Three buckets. Hit them daily — a session counts toward exactly one.</p>
      </div>

      <section className="card">
        <h2>Per day</h2>
        {CATEGORIES.map((c) => (
          <div key={c} style={{ marginTop: 16 }}>
            <div className="goal-row">
              <span>{CATEGORY_LABEL[c]}</span>
              <input
                type="number"
                min={0}
                max={240}
                value={state.goals[c]}
                onChange={(e) =>
                  dispatch({
                    type: 'set-goals',
                    goals: { ...state.goals, [c]: Number(e.target.value) || 0 },
                  })
                }
              />
              <span className="num">min / day</span>
            </div>
            <p className="faint">{CATEGORY_BLURB[c]}</p>
          </div>
        ))}
      </section>
    </div>
  )
}

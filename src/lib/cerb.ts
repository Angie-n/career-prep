import type { Category, DailyGoals } from './types'
import { CATEGORIES } from './types'

export type CerbMood = 'angry' | 'disappointed' | 'happy'

const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`

export const CERB: Record<CerbMood, { src: string; status: string; alt: string }> = {
  angry: {
    src: asset('assets/cerb-angry.png'),
    status: 'Cerb is excited for you to start getting work done!',
    alt: 'Cerb looking angry and ready for you to start',
  },
  disappointed: {
    src: asset('assets/cerb-disappointed.png'),
    status: 'Cerb is seeing your progress and knows you could do more.',
    alt: 'Cerb looking disappointed but hopeful',
  },
  happy: {
    src: asset('assets/cerb-happy.png'),
    status: 'Cerb always knew you could do it!',
    alt: 'Cerb looking happy that you hit your goals',
  },
}

export function cerbMood(mins: Record<Category, number>, goals: DailyGoals): CerbMood {
  const allMet = CATEGORIES.every((c) => mins[c] >= goals[c])
  if (allMet) return 'happy'
  const credited = CATEGORIES.reduce((n, c) => n + Math.min(mins[c], goals[c]), 0)
  const totalGoal = CATEGORIES.reduce((n, c) => n + goals[c], 0)
  const pct = totalGoal > 0 ? (credited / totalGoal) * 100 : 0
  if (pct < 10) return 'angry'
  return 'disappointed'
}

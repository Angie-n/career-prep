import { NavLink, useLocation } from 'react-router-dom'
import { type Category } from '../lib/types'

type Item = {
  to: string
  label: string
  end?: boolean
  matchPrefix?: string
}

function itemsFor(category: Category): Item[] {
  if (category === 'applications') {
    return [
      { to: '/applications', label: 'Home', end: true },
      { to: '/applications/saved', label: 'Applications', matchPrefix: '/applications/saved' },
      { to: '/applications/history', label: 'History' },
    ]
  }
  if (category === 'dsa') {
    return [
      { to: '/dsa', label: 'Home', end: true },
      { to: '/dsa/history', label: 'History' },
      { to: '/dsa/tracker', label: 'Tracker' },
    ]
  }
  return [
    { to: '/practice', label: 'Home', end: true },
    { to: '/practice/history', label: 'History' },
    { to: '/practice/stories', label: 'Stories', matchPrefix: '/practice/stories' },
    { to: '/practice/prompts', label: 'Prompts', matchPrefix: '/practice/prompts' },
  ]
}

export function CategorySubnav({ category }: { category: Category }) {
  const location = useLocation()
  return (
    <nav className="subnav" aria-label="Category sections">
      {itemsFor(category).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            isActive || (item.matchPrefix != null && location.pathname.startsWith(item.matchPrefix))
              ? 'active'
              : undefined
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

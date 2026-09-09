import { CategorySubnav } from '../components/CategorySubnav'
import { CommunicationBank } from '../components/CommunicationBank'
import { RecentSessions } from '../components/RecentSessions'
import { CATEGORY_LABEL, type Category } from '../lib/types'

export function CategoryHistory({ category }: { category: Category }) {
  return (
    <div className="stack">
      <div>
        <p className="kicker">{CATEGORY_LABEL[category]}</p>
        <h1>History</h1>
        <p className="lead">Previous sessions in this category.</p>
      </div>
      <CategorySubnav category={category} />
      <RecentSessions category={category} />
    </div>
  )
}

export function PracticeNotes() {
  return (
    <div className="stack">
      <div>
        <p className="kicker">Communication</p>
        <h1>Notes</h1>
        <p className="lead">Stories and prompts to pull from.</p>
      </div>
      <CategorySubnav category="communication" />
      <CommunicationBank />
    </div>
  )
}

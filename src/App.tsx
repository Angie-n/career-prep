import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PromptCategoryDetail, PromptsBank } from './components/PromptsBank'
import { StoriesBank } from './components/StoriesBank'
import { Account } from './pages/Account'
import { Active } from './pages/Active'
import { CategoryHistory } from './pages/CategoryHistory'
import { Dashboard } from './pages/Dashboard'
import { Goals } from './pages/Goals'
import { History } from './pages/History'
import { Practice } from './pages/Practice'
import { StoryEditor } from './pages/StoryEditor'
import { Applications, Dsa } from './pages/Tracks'
import { StoreProvider } from './state/Store'

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/active" element={<Active />} />
            <Route path="/active/:sessionId" element={<Active />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/practice/history" element={<CategoryHistory category="communication" />} />
            <Route path="/practice/stories" element={<StoriesBank />} />
            <Route path="/practice/stories/new" element={<StoryEditor />} />
            <Route path="/practice/stories/:id" element={<StoryEditor />} />
            <Route path="/practice/prompts" element={<PromptsBank />} />
            <Route path="/practice/prompts/:categoryId" element={<PromptCategoryDetail />} />
            <Route path="/practice/notes" element={<Navigate to="/practice/stories" replace />} />
            <Route path="/practice/bank" element={<Navigate to="/practice/prompts" replace />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/applications/history" element={<CategoryHistory category="applications" />} />
            <Route path="/applications/tracker" element={<Applications pane="tracker" />} />
            <Route path="/dsa" element={<Dsa />} />
            <Route path="/dsa/history" element={<CategoryHistory category="dsa" />} />
            <Route path="/dsa/tracker" element={<Dsa pane="tracker" />} />
            <Route path="/stories" element={<Navigate to="/practice/stories" replace />} />
            <Route path="/stories/new" element={<Navigate to="/practice/stories/new" replace />} />
            <Route path="/stories/:id" element={<StoryToPractice />} />
            <Route path="/questions" element={<Navigate to="/practice/prompts" replace />} />
            <Route path="/history" element={<Navigate to="/" replace />} />
            <Route path="/history/:id" element={<History />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/account" element={<Account />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </StoreProvider>
  )
}

function StoryToPractice() {
  const { id } = useParams()
  return <Navigate to={`/practice/stories/${id ?? ''}`} replace />
}

const ENTERED_KEY = 'studio:welcome-done'

export function hasEnteredWorkspace(): boolean {
  if (typeof localStorage === 'undefined') return true
  return localStorage.getItem(ENTERED_KEY) === '1'
}

export function markEnteredWorkspace() {
  localStorage.setItem(ENTERED_KEY, '1')
}

export function clearEnteredWorkspace() {
  localStorage.removeItem(ENTERED_KEY)
}

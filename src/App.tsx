import { AppHeader } from "@/features/roster/components/app-header"
import { RosterWorkspace } from "@/features/roster/components/roster-workspace"

export function App() {
  return (
    <div className="min-h-svh">
      <AppHeader />
      <RosterWorkspace />
    </div>
  )
}

export default App

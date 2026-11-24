import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RosterWorkspace } from "@/features/roster/components/roster-workspace"
import { useScheduleStore } from "@/store/schedule-store"

function PersistenceAlert() {
  const error = useScheduleStore((s) => s.persistenceError)
  const dismiss = useScheduleStore((s) => s.setPersistenceError)
  if (!error) return null
  const text = {
    load: "We couldn't open your saved schedules, so you're starting fresh. New changes may not be kept.",
    corrupt:
      "Your saved schedules were damaged and couldn't be opened, so you're starting fresh. A copy of the damaged data was kept in this browser.",
    save: "Your latest changes couldn't be saved. Don't close this tab until you've exported what you need.",
  }[error]
  return (
    <div className="px-6 pt-4">
      <Alert variant="destructive">
        <AlertTitle>
          {error === "save" ? "Changes aren't being saved" : "Starting fresh"}
        </AlertTitle>
        <AlertDescription>
          {text}{" "}
          <Button
            variant="link"
            className="h-auto p-0"
            onClick={() => dismiss(null)}
          >
            Dismiss
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}

export function App() {
  const hydrated = useScheduleStore((s) => s.hydrated)
  if (!hydrated) {
    return (
      <div
        className="grid min-h-svh place-items-center text-sm text-muted-foreground"
        role="status"
      >
        Loading schedules…
      </div>
    )
  }
  return (
    <div className="min-h-svh">
      <PersistenceAlert />
      <RosterWorkspace />
    </div>
  )
}

export default App

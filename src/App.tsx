import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { RosterWorkspace } from "@/features/roster/components/roster-workspace"
import { useScheduleStore } from "@/store/schedule-store"

function PersistenceAlert() {
  const error = useScheduleStore((s) => s.persistenceError)
  const dismiss = useScheduleStore((s) => s.setPersistenceError)
  if (!error) return null
  const text = {
    load: "Saved data couldn't be read (storage may be unavailable), so the app started empty. New changes might not be saved.",
    corrupt:
      "Saved data was unreadable, so the app started empty. The unreadable data was kept aside in this browser.",
    save: "Changes couldn't be saved to this browser. Export what you need before closing this tab.",
  }[error]
  return (
    <div className="px-6 pt-4">
      <Alert variant="destructive">
        <AlertTitle>
          {error === "save" ? "Changes are not being saved" : "Starting empty"}
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

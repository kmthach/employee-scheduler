import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import { useAutoSchedule } from "../use-auto-schedule"

interface Props {
  staffCount: number
  shiftCount: number
  hasTransactions: boolean
}

/** Why Auto-schedule cannot run yet, or null when it can. */
function blockedReason(p: Props): string | null {
  if (!p.hasTransactions) return "Upload transactions first"
  if (p.staffCount === 0) return "Add employees first"
  if (p.shiftCount === 0) return "Add shift templates first"
  return null
}

export function AutoScheduleButton(
  props: Props & { auto: ReturnType<typeof useAutoSchedule> }
) {
  const { auto } = props
  const reason = blockedReason(props)

  return (
    <Button
      variant="secondary"
      className="h-9"
      disabled={reason !== null || auto.status === "running"}
      title={reason ?? undefined}
      onClick={() => auto.run()}
    >
      Auto-schedule
    </Button>
  )
}

/** Error state for the last run (success is visible in the roster itself). */
export function AutoScheduleError({
  auto,
}: {
  auto: ReturnType<typeof useAutoSchedule>
}) {
  if (auto.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Auto-schedule failed</AlertTitle>
        <AlertDescription>
          {auto.error} Your roster was not changed.
        </AlertDescription>
        <div data-slot="alert-action" className="absolute top-2 right-2">
          <Button size="sm" variant="outline" onClick={() => auto.run()}>
            Retry
          </Button>
        </div>
      </Alert>
    )
  }

  return null
}

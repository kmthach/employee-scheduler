import { AlertTriangle, Loader2, Sparkles, Undo2, X } from "lucide-react"
import { useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatRange } from "@/domain/auto-schedule-report"
import { DAYS_OF_WEEK } from "@/domain/types"
import { useScheduleStore } from "@/store/schedule-store"

import { useAutoSchedule } from "../use-auto-schedule"

interface Props {
  scheduleId: string
  staffCount: number
  shiftCount: number
  hasTransactions: boolean
  assignmentCount: number
  isPublished: boolean
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
  const { auto, assignmentCount, isPublished } = props
  const [confirm, setConfirm] = useState(false)
  const reason = blockedReason(props)
  const running = auto.status === "running"

  if (running) {
    return (
      <div className="flex items-center gap-2">
        <Button disabled>
          <Loader2 className="animate-spin" /> Generating…
        </Button>
        <Button variant="outline" onClick={auto.cancel}>
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <>
      <Button
        disabled={reason !== null}
        title={reason ?? undefined}
        onClick={() => (assignmentCount > 0 ? setConfirm(true) : auto.run())}
      >
        <Sparkles /> Auto-schedule
      </Button>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Replace this week's assignments?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Auto-schedule replaces all {assignmentCount} current assignment
              {assignmentCount === 1 ? "" : "s"}, including any you added by
              hand, with a new draft. You can undo it right afterwards.
              {isPublished &&
                " The published version is kept until you publish."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current roster</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(false)
                auto.run()
              }}
            >
              Replace and generate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/** Result, undo, understaffing notes and error state for the last run. */
export function AutoScheduleReport({
  scheduleId,
  auto,
}: {
  scheduleId: string
  auto: ReturnType<typeof useAutoSchedule>
}) {
  const undoInfo = useScheduleStore((s) => s.autoScheduleUndo)
  const undo = useScheduleStore((s) => s.undoAutoSchedule)

  if (auto.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Auto-schedule failed</AlertTitle>
        <AlertDescription>
          {auto.error} Your roster was not changed.
        </AlertDescription>
        <div data-slot="alert-action" className="absolute top-2 right-2">
          <Button size="sm" variant="outline" onClick={auto.run}>
            Retry
          </Button>
        </div>
      </Alert>
    )
  }

  const summary = auto.summary
  if (!summary || summary.scheduleId !== scheduleId) return null
  const canUndo = undoInfo?.scheduleId === scheduleId

  return (
    <Alert>
      <Sparkles />
      <AlertTitle>
        Draft generated: {summary.assignmentCount} assignment
        {summary.assignmentCount === 1 ? "" : "s"}
      </AlertTitle>
      <AlertDescription>
        <p>Review and edit it like any manual roster.</p>
        {summary.unstaffed.length > 0 && (
          <p className="text-amber-700 dark:text-amber-400">
            No staff while transactions occur:{" "}
            {summary.unstaffed
              .map((r) => `${DAYS_OF_WEEK[r.dayOfWeek]} ${formatRange(r)}`)
              .join(" · ")}
            .
          </p>
        )}
        {summary.overMax.length > 0 && (
          <p className="text-amber-700 dark:text-amber-400">
            Over maximum hours:{" "}
            {summary.overMax
              .map((o) => `${o.name} ${o.hours}h of ${o.maxWeeklyHours}h`)
              .join(" · ")}
            .
          </p>
        )}
        {summary.notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </AlertDescription>
      <div
        data-slot="alert-action"
        className="absolute top-2 right-2 flex gap-1"
      >
        {canUndo && (
          <Button size="sm" variant="outline" onClick={undo}>
            <Undo2 /> Undo
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss"
          onClick={auto.dismiss}
        >
          <X />
        </Button>
      </div>
    </Alert>
  )
}

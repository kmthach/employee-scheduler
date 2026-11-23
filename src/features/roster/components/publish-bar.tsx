import { Undo2 } from "lucide-react"
import { useState, type ReactNode } from "react"

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
import { validateForPublish } from "@/domain/draft"
import { describeConflict } from "@/domain/shift"
import { DAYS_OF_WEEK } from "@/domain/types"
import type { Assignment, Schedule, Shift, Staff } from "@/domain/types"
import { useScheduleStore } from "@/store/schedule-store"

interface Props {
  schedule: Schedule
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
  /** Rendered in the button row, after Publish/Discard (the week selector). */
  children?: ReactNode
}

/** Publish button (reads "Published" and is disabled once published) and Discard changes. */
export function PublishBar({ schedule, staff, shifts, assignments, children }: Props) {
  const publish = useScheduleStore((s) => s.publishSchedule)
  const discard = useScheduleStore((s) => s.discardDraft)
  const hasPublishedVersion = useScheduleStore(
    (s) => s.publishedSnapshots[schedule.id] !== undefined
  )
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const isDraft = schedule.status === "draft"
  // Overlaps and employees over their maximum hours both block publishing.
  const validation = validateForPublish({ staff, shifts, assignments })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="lg"
          className="rounded-full px-6"
          onClick={publish}
          disabled={!isDraft || !validation.ok}
        >
          {isDraft ? "Publish" : "Published"}
        </Button>
        {isDraft && hasPublishedVersion && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setConfirmDiscard(true)}
          >
            <Undo2 /> Discard changes
          </Button>
        )}
        {children}
      </div>

      {isDraft && validation.conflicts.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>Fix overlapping shifts before publishing</AlertTitle>
          <AlertDescription>
            {validation.conflicts
              .map((c) => describeConflict(c, staff, DAYS_OF_WEEK))
              .join(" ")}
          </AlertDescription>
        </Alert>
      )}
      {isDraft && validation.overMax.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>
            Reduce hours over the maximum before publishing
          </AlertTitle>
          <AlertDescription>
            {validation.overMax
              .map(
                (o) =>
                  `${o.staff.name}: ${o.assigned}h of ${o.staff.maxWeeklyHours}h.`
              )
              .join(" ")}
          </AlertDescription>
        </Alert>
      )}

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              All unpublished changes are removed and the last published
              schedule is restored. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                discard()
                setConfirmDiscard(false)
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

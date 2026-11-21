import { Undo2 } from "lucide-react"
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
}

/** Publish button (reads "Published" and is disabled once published) and Discard changes. */
export function PublishBar({ schedule, staff, shifts, assignments }: Props) {
  const publish = useScheduleStore((s) => s.publishSchedule)
  const discard = useScheduleStore((s) => s.discardDraft)
  const hasPublishedVersion = useScheduleStore(
    (s) => s.publishedSnapshots[schedule.id] !== undefined
  )
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const isDraft = schedule.status === "draft"
  // Only overlaps block publishing; max-hours is a warning shown elsewhere.
  const validation = validateForPublish({ staff, shifts, assignments })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={publish}
          disabled={!isDraft || !validation.ok}
        >
          {isDraft ? "Publish" : "Published"}
        </Button>
        {isDraft && hasPublishedVersion && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setConfirmDiscard(true)}
          >
            <Undo2 /> Discard changes
          </Button>
        )}
      </div>

      {isDraft && !validation.ok && (
        <Alert variant="destructive">
          <AlertTitle>Fix overlapping shifts before publishing</AlertTitle>
          <AlertDescription>
            {validation.conflicts
              .map((c) => describeConflict(c, staff, DAYS_OF_WEEK))
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

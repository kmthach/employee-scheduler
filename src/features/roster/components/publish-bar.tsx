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
import { Button } from "@/components/ui/button"
import { hasContentChanges, validateForPublish } from "@/domain/draft"
import type { Assignment, Schedule, Shift, Staff } from "@/domain/types"
import { useScheduleStore } from "@/store/schedule-store"

interface Props {
  schedule: Schedule
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
  /** Left side of the header row (the week selector). */
  leading?: ReactNode
  /** Auto-schedule, Upload and Shifts controls, left of Discard/Publish in the header row. */
  actions?: ReactNode
}

/** Publish button (reads "Published" and is disabled once published) and Discard changes. */
export function PublishBar({
  schedule,
  staff,
  shifts,
  assignments,
  leading,
  actions,
}: Props) {
  const publish = useScheduleStore((s) => s.publishSchedule)
  const discard = useScheduleStore((s) => s.discardDraft)
  const snapshot = useScheduleStore((s) => s.publishedSnapshots[schedule.id])
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const isDraft = schedule.status === "draft"
  // A draft of a published schedule only counts as changed while it differs from the published
  // version; reverting every change makes it identical again (no Discard, nothing to publish).
  const hasChanges = snapshot
    ? hasContentChanges(snapshot, { staff, shifts, assignments })
    : true
  const unchanged = snapshot !== undefined && !hasChanges
  // Overlaps and employees over their maximum hours both block publishing.
  const validation = validateForPublish({ staff, shifts, assignments })

  return (
    <div className="flex flex-col gap-3">
      {/* One row: when (week navigation) on the left, what to do on the right, Publish last. */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        {leading}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {actions}
          {isDraft && snapshot && hasChanges && (
            <Button
              variant="ghost"
              className="h-9 text-muted-foreground"
              onClick={() => setConfirmDiscard(true)}
            >
              <Undo2 /> Discard changes
            </Button>
          )}
          <Button
            className="h-9 px-5 font-semibold"
            onClick={publish}
            disabled={!isDraft || unchanged || !validation.ok}
          >
            {isDraft && !unchanged ? "Publish" : "Published"}
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Your unpublished changes will be lost and the last published
              schedule will come back. This can't be undone.
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

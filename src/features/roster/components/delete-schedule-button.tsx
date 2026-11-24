import { Trash2 } from "lucide-react"
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
import { Button } from "@/components/ui/button"
import { formatWeekRange } from "@/domain/date"
import { useScheduleStore } from "@/store/schedule-store"

export function DeleteScheduleButton({
  scheduleId,
  isPublished,
  disabled,
}: {
  scheduleId: string
  isPublished: boolean
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const deleteSchedule = useScheduleStore((s) => s.deleteSchedule)

  return (
    <>
      <Button
        variant="ghost"
        className="h-9"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <Trash2 /> Delete schedule
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              {isPublished
                ? "The published schedule for "
                : "The schedule for "}
              {formatWeekRange(scheduleId)} will be deleted along with its
              employees, shifts and transactions. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                deleteSchedule()
                setOpen(false)
              }}
            >
              Delete schedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

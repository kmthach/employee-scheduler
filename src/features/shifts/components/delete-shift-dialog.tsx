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
import type { Shift } from "@/domain/types"

interface Props {
  shift: Shift | null
  assignmentCount: number
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string) => void
}

export function DeleteShiftDialog({ shift, assignmentCount, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={shift !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {shift?.startTime}–{shift?.endTime}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {assignmentCount > 0
              ? `This also removes ${assignmentCount} assignment${assignmentCount === 1 ? "" : "s"} that use this shift.`
              : "No one is assigned to this shift."}{" "}
            This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => shift && onConfirm(shift.id)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

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
import type { Staff } from "@/domain/types"

interface Props {
  staff: Staff | null
  assignmentCount: number
  onOpenChange: (open: boolean) => void
  onConfirm: (id: string) => void
}

export function DeleteStaffDialog({ staff, assignmentCount, onOpenChange, onConfirm }: Props) {
  return (
    <AlertDialog open={staff !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {staff?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {assignmentCount > 0
              ? `This also removes ${assignmentCount} assigned shift${assignmentCount === 1 ? "" : "s"} from this schedule.`
              : "This employee has no assigned shifts."}{" "}
            This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => staff && onConfirm(staff.id)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getShiftUsage, sortShifts } from "@/domain/shift"
import type { ShiftValidation } from "@/domain/shift"
import { shiftDurationHours } from "@/domain/time"
import type { Assignment, Shift } from "@/domain/types"
import { useScheduleStore } from "@/store/schedule-store"

import { DeleteShiftDialog } from "./delete-shift-dialog"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  shifts: Shift[]
  assignments: Assignment[]
}

export function ShiftTemplatesDialog({
  open,
  onOpenChange,
  shifts,
  assignments,
}: Props) {
  const deleteShift = useScheduleStore((s) => s.deleteShift)
  // "new" = adding, a shift id = editing that shift, null = just listing.
  const [editing, setEditing] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Shift | null>(null)

  const sorted = sortShifts(shifts)

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
          onOpenChange(next)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Shifts</DialogTitle>
            <DialogDescription>
              The shifts you can assign this week.
            </DialogDescription>
          </DialogHeader>

          <ul className="grid gap-2">
            {sorted.length === 0 && (
              <li className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No shifts yet. Add one to start assigning employees.
              </li>
            )}
            {sorted.map((shift) =>
              editing === shift.id ? (
                <li key={shift.id} className="rounded-lg border p-3">
                  <ShiftForm shift={shift} onDone={() => setEditing(null)} />
                </li>
              ) : (
                <li
                  key={shift.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <div className="font-medium">
                      {shift.startTime}–{shift.endTime}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {shiftDurationHours(shift)}h · Used by{" "}
                      {getShiftUsage(assignments, shift.id)} assignment
                      {getShiftUsage(assignments, shift.id) === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div className="flex">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${shift.startTime}–${shift.endTime}`}
                      onClick={() => setEditing(shift.id)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${shift.startTime}–${shift.endTime}`}
                      onClick={() => setDeleting(shift)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              )
            )}
          </ul>

          {editing === "new" ? (
            <div className="rounded-lg border p-3">
              <ShiftForm onDone={() => setEditing(null)} />
            </div>
          ) : (
            <Button
              variant="outline"
              className="justify-self-start"
              onClick={() => setEditing("new")}
            >
              <Plus /> Add shift
            </Button>
          )}
        </DialogContent>
      </Dialog>

      <DeleteShiftDialog
        shift={deleting}
        assignmentCount={deleting ? getShiftUsage(assignments, deleting.id) : 0}
        onOpenChange={(next) => !next && setDeleting(null)}
        onConfirm={(id) => {
          deleteShift(id)
          setDeleting(null)
        }}
      />
    </>
  )
}

function ShiftForm({ shift, onDone }: { shift?: Shift; onDone: () => void }) {
  const addShift = useScheduleStore((s) => s.addShift)
  const updateShift = useScheduleStore((s) => s.updateShift)
  const [startTime, setStartTime] = useState(shift?.startTime ?? "09:00")
  const [endTime, setEndTime] = useState(shift?.endTime ?? "17:00")
  const [errors, setErrors] = useState<ShiftValidation["errors"]>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = { startTime, endTime }
    const result = shift ? updateShift(shift.id, input) : addShift(input)
    if (result.ok) {
      onDone()
      return
    }
    setErrors(result.errors)
  }

  const prefix = shift ? "Edit" : "New"
  return (
    <form onSubmit={handleSubmit} className="grid gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefix}-start`}>Start</Label>
          <Input
            id={`${prefix}-start`}
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            aria-invalid={!!errors.startTime}
            autoFocus
          />
          {errors.startTime && (
            <p className="text-xs text-destructive">{errors.startTime}</p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${prefix}-end`}>End</Label>
          <Input
            id={`${prefix}-end`}
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            aria-invalid={!!errors.endTime}
          />
          {errors.endTime && (
            <p className="text-xs text-destructive">{errors.endTime}</p>
          )}
        </div>
      </div>
      {errors.form && <p className="text-xs text-destructive">{errors.form}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{shift ? "Save" : "Add shift"}</Button>
      </div>
    </form>
  )
}

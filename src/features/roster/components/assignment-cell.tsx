import { Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { checkAssignment, describeBlock } from "@/domain/assignment"
import { shiftDurationHours } from "@/domain/time"
import { DAYS_OF_WEEK } from "@/domain/types"
import type { Assignment, DayOfWeek, Shift, Staff } from "@/domain/types"
import { cn } from "@/lib/utils"
import { useScheduleStore } from "@/store/schedule-store"

interface Props {
  person: Staff
  dayOfWeek: DayOfWeek
  /** The schedule's shift templates, sorted. */
  shifts: Shift[]
  /** All of the schedule's staff and assignments, used to check for overlaps. */
  staff: Staff[]
  assignments: Assignment[]
  shiftColor: (shiftId: string) => string
  onOpenShifts: () => void
}

const label = (s: Shift) => `${s.startTime}–${s.endTime}`

export function AssignmentCell({
  person,
  dayOfWeek,
  shifts,
  staff,
  assignments,
  shiftColor,
  onOpenShifts,
}: Props) {
  const assignShift = useScheduleStore((s) => s.assignShift)
  const changeShift = useScheduleStore((s) => s.changeAssignmentShift)
  const removeAssignment = useScheduleStore((s) => s.removeAssignment)

  const dayName = DAYS_OF_WEEK[dayOfWeek]
  const cellAssignments = assignments.filter(
    (a) => a.staffId === person.id && a.dayOfWeek === dayOfWeek
  )

  function blockReason(shiftId: string, ignoreId?: string): string | null {
    const check = checkAssignment(
      { staff, shifts, assignments },
      { staffId: person.id, shiftId, dayOfWeek },
      ignoreId
    )
    return check.ok ? null : describeBlock(check, shifts)
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {cellAssignments.map((a) => {
        const shift = shifts.find((s) => s.id === a.shiftId)
        if (!shift) return null
        return (
          <DropdownMenu key={a.id}>
            <DropdownMenuTrigger
              aria-label={`${label(shift)} on ${dayName}, actions`}
              render={
                <button type="button" className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50" />
              }
            >
              <Badge variant="secondary" className={cn("rounded-md", shiftColor(shift.id))}>
                {label(shift)}
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change shift</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {shifts
                    .filter((s) => s.id !== shift.id)
                    .map((s) => {
                      const reason = blockReason(s.id, a.id)
                      return (
                        <DropdownMenuItem
                          key={s.id}
                          disabled={reason !== null}
                          onClick={() => changeShift(a.id, s.id)}
                        >
                          <span>{label(s)}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {reason ?? `${shiftDurationHours(s)}h`}
                          </span>
                        </DropdownMenuItem>
                      )
                    })}
                  {shifts.length <= 1 && (
                    <DropdownMenuItem disabled>No other shifts</DropdownMenuItem>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => removeAssignment(a.id)}>
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Assign shift to ${person.name} on ${dayName}`}
              className="text-muted-foreground"
            />
          }
        >
          <Plus />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          {shifts.length === 0 ? (
            <DropdownMenuItem onClick={onOpenShifts}>No shifts — manage shifts…</DropdownMenuItem>
          ) : (
            shifts.map((s) => {
              const reason = blockReason(s.id)
              return (
                <DropdownMenuItem
                  key={s.id}
                  disabled={reason !== null}
                  onClick={() => assignShift({ staffId: person.id, shiftId: s.id, dayOfWeek })}
                >
                  <span>{label(s)}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {reason ?? `${shiftDurationHours(s)}h`}
                  </span>
                </DropdownMenuItem>
              )
            })
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

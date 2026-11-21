import { Plus, Undo2 } from "lucide-react"

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
import { assignmentKey } from "@/domain/draft"
import type { AssignmentDiff } from "@/domain/draft"
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
  /** Differences from the published version, when a published schedule has a draft. */
  diff?: AssignmentDiff
  /** Published shift templates, so removed assignments of since-deleted shifts can still be labelled. */
  publishedShifts?: Shift[]
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
  diff,
  publishedShifts,
  shiftColor,
  onOpenShifts,
}: Props) {
  const assignShift = useScheduleStore((s) => s.assignShift)
  const restoreAssignment = useScheduleStore((s) => s.restoreAssignment)
  const changeShift = useScheduleStore((s) => s.changeAssignmentShift)
  const removeAssignment = useScheduleStore((s) => s.removeAssignment)

  const dayName = DAYS_OF_WEEK[dayOfWeek]
  const cellAssignments = assignments.filter(
    (a) => a.staffId === person.id && a.dayOfWeek === dayOfWeek
  )

  const pendingRemovals = (diff?.removed ?? []).filter(
    (a) => a.staffId === person.id && a.dayOfWeek === dayOfWeek
  )

  // Shifts this employee already has today are not offered again.
  // Shifts pending removal are not offered either: they come back through "Revert" only.
  const assignedShiftIds = new Set(
    [...cellAssignments, ...pendingRemovals].map((a) => a.shiftId)
  )

  // With every shift already assigned there is nothing left to add, so no "+" button.
  const allAssigned =
    shifts.length > 0 && shifts.every((s) => assignedShiftIds.has(s.id))

  function blockReason(shiftId: string, ignoreId?: string): string | null {
    const check = checkAssignment(
      { staff, shifts, assignments },
      { staffId: person.id, shiftId, dayOfWeek },
      ignoreId
    )
    return check.ok ? null : describeBlock(check, shifts)
  }

  // Live and pending-removal assignments share one list, always ordered by shift start time.
  const shiftOf = (a: Assignment) =>
    shifts.find((s) => s.id === a.shiftId) ??
    publishedShifts?.find((s) => s.id === a.shiftId)
  const items = [
    ...cellAssignments.map((assignment) => ({ assignment, pending: false })),
    ...pendingRemovals.map((assignment) => ({ assignment, pending: true })),
  ]
    .map((item) => ({ ...item, shift: shiftOf(item.assignment) }))
    .filter((item) => item.shift)
    .sort(
      (x, y) =>
        x.shift!.startTime.localeCompare(y.shift!.startTime) ||
        x.shift!.endTime.localeCompare(y.shift!.endTime)
    )

  const renderLive = (a: Assignment) => {
    const shift = shifts.find((s) => s.id === a.shiftId)
    if (!shift) return null
    const isNew = diff?.addedKeys.has(assignmentKey(a)) ?? false
    return (
      <DropdownMenu key={a.id}>
        <DropdownMenuTrigger
          aria-label={`${label(shift)} on ${dayName}, actions`}
          render={
            <button
              type="button"
              className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <Badge
            variant="secondary"
            title={isNew ? "Not published yet" : undefined}
            className={cn(
              "rounded-md",
              isNew
                ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                : shiftColor(shift.id)
            )}
          >
            {label(shift)}
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Change shift</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {shifts
                .filter((s) => !assignedShiftIds.has(s.id))
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
              {shifts.every((s) => assignedShiftIds.has(s.id)) && (
                <DropdownMenuItem disabled>No other shifts</DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => removeAssignment(a.id)}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const renderPending = (a: Assignment) => {
    const shift =
      shifts.find((s) => s.id === a.shiftId) ??
      publishedShifts?.find((s) => s.id === a.shiftId)
    if (!shift) return null
    // Reverting is allowed even if it creates an overlap (highlighted; publishing stays blocked).
    // It is only impossible when the shift template itself was deleted (Discard changes restores it).
    const reason = shifts.some((s) => s.id === a.shiftId)
      ? null
      : "Shift template deleted"
    return (
      <div
        key={a.id}
        className="group/removed relative min-w-20"
        title={`${label(shift)} will be removed when you publish`}
      >
        <Badge
          variant="secondary"
          className="w-full rounded-md line-through opacity-50"
          aria-label={`${label(shift)} on ${dayName}, pending removal`}
        >
          {label(shift)}
        </Badge>
        {/* Same size and shape as the badge, so hovering swaps the label without shifting layout. */}
        <button
          type="button"
          disabled={reason !== null}
          title={reason ?? "Revert removal"}
          aria-label={`Revert removal of ${label(shift)} on ${dayName}`}
          className="absolute inset-0 inline-flex items-center justify-center gap-1 rounded-md bg-secondary text-xs font-medium text-secondary-foreground opacity-0 transition-opacity outline-none group-hover/removed:opacity-100 hover:bg-secondary/80 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:hover:bg-secondary [&_svg]:size-3"
          onClick={() =>
            restoreAssignment({
              staffId: person.id,
              shiftId: a.shiftId,
              dayOfWeek,
            })
          }
        >
          <Undo2 /> Revert
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-start gap-1">
      {items.map(({ assignment, pending }) =>
        pending ? renderPending(assignment) : renderLive(assignment)
      )}

      {!allAssigned && (
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
              <DropdownMenuItem onClick={onOpenShifts}>
                No shifts — manage shifts…
              </DropdownMenuItem>
            ) : (
              shifts
                .filter((s) => !assignedShiftIds.has(s.id))
                .map((s) => {
                  const reason = blockReason(s.id)
                  return (
                    <DropdownMenuItem
                      key={s.id}
                      disabled={reason !== null}
                      onClick={() =>
                        assignShift({
                          staffId: person.id,
                          shiftId: s.id,
                          dayOfWeek,
                        })
                      }
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
      )}
    </div>
  )
}

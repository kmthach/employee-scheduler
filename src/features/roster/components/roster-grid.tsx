import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getWeekDays } from "@/domain/date"
import { diffAssignments } from "@/domain/draft"
import { getAssignedHours, getHoursStatus } from "@/domain/hours"
import { sortShifts } from "@/domain/shift"
import type {
  Assignment,
  DayOfWeek,
  ScheduleContent,
  Shift,
  Staff,
} from "@/domain/types"
import { cn } from "@/lib/utils"

import { AssignmentCell } from "./assignment-cell"

interface Props {
  scheduleId: string
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
  /** Last published content, present while a published schedule has unpublished changes. */
  published?: ScheduleContent
  onAddStaff: () => void
  onOpenShifts: () => void
  onEditStaff: (staff: Staff) => void
  onDeleteStaff: (staff: Staff) => void
}

const SHIFT_COLORS = [
  "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
]

export function RosterGrid({
  scheduleId,
  staff,
  shifts,
  assignments,
  published,
  onAddStaff,
  onOpenShifts,
  onEditStaff,
  onDeleteStaff,
}: Props) {
  const days = getWeekDays(scheduleId)
  const sortedShifts = sortShifts(shifts)
  const diff = published
    ? diffAssignments(published.assignments, assignments)
    : undefined
  const shiftColor = (shiftId: string) => {
    const index = sortedShifts.findIndex((s) => s.id === shiftId)
    return SHIFT_COLORS[Math.max(index, 0) % SHIFT_COLORS.length]
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[960px] table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-44">Employee</TableHead>
            {days.map((d) => (
              <TableHead key={d.getTime()} className="border-l">
                <div>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((person) => (
            <TableRow
              key={person.id}
              className="align-top hover:bg-transparent has-aria-expanded:bg-transparent"
            >
              <TableCell className="font-medium whitespace-normal transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate">{person.name}</div>
                    <HoursLabel
                      assigned={getAssignedHours(
                        person.id,
                        assignments,
                        shifts
                      )}
                      max={person.maxWeeklyHours}
                    />
                  </div>
                  <div className="flex shrink-0">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${person.name}`}
                      onClick={() => onEditStaff(person)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${person.name}`}
                      onClick={() => onDeleteStaff(person)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </TableCell>
              {days.map((_, dayIndex) => (
                <TableCell
                  key={dayIndex}
                  className="border-l transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50"
                >
                  <AssignmentCell
                    person={person}
                    dayOfWeek={dayIndex as DayOfWeek}
                    shifts={sortedShifts}
                    staff={staff}
                    assignments={assignments}
                    diff={diff}
                    publishedShifts={published?.shifts}
                    shiftColor={shiftColor}
                    onOpenShifts={onOpenShifts}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow className="hover:bg-transparent has-aria-expanded:bg-transparent">
            <TableCell colSpan={days.length + 1} className="p-1">
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={onAddStaff}
              >
                <Plus /> Add employee
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function HoursLabel({ assigned, max }: { assigned: number; max: number }) {
  const status = getHoursStatus(assigned, max)
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs font-normal text-muted-foreground",
        status === "over" && "font-medium text-amber-600 dark:text-amber-400"
      )}
      title={status === "over" ? "Over maximum weekly hours" : undefined}
    >
      {status === "over" && <AlertTriangle className="size-3" />}
      {assigned}h / max {max}h
    </div>
  )
}

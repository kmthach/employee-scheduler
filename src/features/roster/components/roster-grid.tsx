import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { getAssignedHours, getHoursStatus } from "@/domain/hours"
import { sortShifts } from "@/domain/shift"
import type { Assignment, Shift, Staff } from "@/domain/types"
import { cn } from "@/lib/utils"

interface Props {
  scheduleId: string
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
  onAddStaff: () => void
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
  onAddStaff,
  onEditStaff,
  onDeleteStaff,
}: Props) {
  const days = getWeekDays(scheduleId)
  const shiftById = new Map(sortShifts(shifts).map((s, i) => [s.id, { shift: s, index: i }]))

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table className="min-w-[960px] table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-44">Employee</TableHead>
            {days.map((d) => (
              <TableHead key={d.getTime()} className="border-l">
                <div>{d.toLocaleDateString("en-US", { weekday: "short" })}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {staff.map((person) => (
            <TableRow key={person.id} className="align-top">
              <TableCell className="font-medium whitespace-normal">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate">{person.name}</div>
                    <HoursLabel
                      assigned={getAssignedHours(person.id, assignments, shifts)}
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
                <TableCell key={dayIndex} className="border-l">
                  <div className="flex flex-col gap-1">
                    {assignments
                      .filter((a) => a.staffId === person.id && a.dayOfWeek === dayIndex)
                      .map((a) => {
                        const entry = shiftById.get(a.shiftId)
                        if (!entry) return null
                        return (
                          <Badge
                            key={a.id}
                            variant="secondary"
                            className={cn("rounded-md", SHIFT_COLORS[entry.index % SHIFT_COLORS.length])}
                          >
                            {entry.shift.startTime}–{entry.shift.endTime}
                          </Badge>
                        )
                      })}
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={days.length + 1} className="p-1">
              <Button variant="ghost" className="w-full justify-start" onClick={onAddStaff}>
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

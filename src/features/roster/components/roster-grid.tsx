import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getWeekDays } from "@/domain/date"
import type { Assignment, Shift, Staff } from "@/domain/types"
import { cn } from "@/lib/utils"

interface Props {
  scheduleId: string
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
}

const SHIFT_COLORS = [
  "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
  "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
]

export function RosterGrid({ scheduleId, staff, shifts, assignments }: Props) {
  const days = getWeekDays(scheduleId)
  const shiftById = new Map(shifts.map((s, i) => [s.id, { shift: s, index: i }]))

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
                <div>{person.name}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  Max {person.maxWeeklyHours}h / week
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
        </TableBody>
      </Table>
    </div>
  )
}

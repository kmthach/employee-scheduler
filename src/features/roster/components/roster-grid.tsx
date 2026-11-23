import {
  AlertTriangle,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getWeekDays, isToday } from "@/domain/date"
import { diffAssignments } from "@/domain/draft"
import {
  getAssignedHours,
  getDailyAssignedHours,
  getHoursStatus,
} from "@/domain/hours"
import {
  findOverlapConflicts,
  overlapCellKeys,
  sortShifts,
} from "@/domain/shift"
import type { WeekCoverage } from "@/domain/coverage"
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
  /** Hourly coverage per day; when set, day headers open that day's coverage drawer. */
  coverage?: WeekCoverage
  /** Day (0 = Monday) the coverage drawer is inspecting; its column header is highlighted. */
  selectedDay?: number | null
  onSelectDay?: (dayIndex: number) => void
  onAddStaff: () => void
  onOpenShifts: () => void
  onEditStaff: (staff: Staff) => void
  onDeleteStaff: (staff: Staff) => void
}

// Soft tinted surface, dark text, 3px left accent bar (indigo, emerald, violet).
const SHIFT_COLORS = [
  "border-transparent border-l-[3px] border-l-[#4F46E5] bg-[#EEF2FF] text-[#3730A3] dark:bg-[#4F46E5]/20 dark:text-[#C7D2FE]",
  "border-transparent border-l-[3px] border-l-[#059669] bg-[#ECFDF5] text-[#065F46] dark:bg-[#059669]/20 dark:text-[#A7F3D0]",
  "border-transparent border-l-[3px] border-l-[#7C3AED] bg-[#F5F3FF] text-[#5B21B6] dark:bg-[#7C3AED]/20 dark:text-[#DDD6FE]",
]

export function RosterGrid({
  scheduleId,
  staff,
  shifts,
  assignments,
  published,
  coverage,
  selectedDay = null,
  onSelectDay,
  onAddStaff,
  onOpenShifts,
  onEditStaff,
  onDeleteStaff,
}: Props) {
  const days = getWeekDays(scheduleId)
  const sortedShifts = sortShifts(shifts)
  const overlapCells = overlapCellKeys(
    findOverlapConflicts(shifts, assignments)
  )
  const dailyTotals = getDailyAssignedHours(assignments, shifts)
  const weekTotal = dailyTotals.reduce((n, h) => n + h, 0)
  const diff = published
    ? diffAssignments(published.assignments, assignments)
    : undefined
  const shiftColor = (shiftId: string) => {
    const index = sortedShifts.findIndex((s) => s.id === shiftId)
    return SHIFT_COLORS[Math.max(index, 0) % SHIFT_COLORS.length]
  }

  const tableClass = "table-fixed"
  const gutter =
    "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden *:data-[slot=table-container]:overflow-visible"

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className="flex min-h-0 min-w-[960px] flex-1 flex-col">
          <div className={cn("overflow-y-hidden bg-background", gutter)}>
            <Table className={tableClass}>
              <GridColumns />
              <TableHeader>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="w-44 bg-background align-bottom">
                    Employee
                  </TableHead>
                  {days.map((d, dayIndex) => {
                    const today = isToday(d)
                    const shortfall =
                      coverage?.days[dayIndex]?.totals.shortfall ?? 0
                    const header = (
                      <>
                        <div
                          className={cn(
                            "text-xs font-medium tracking-wide text-muted-foreground uppercase",
                            today && "text-primary"
                          )}
                        >
                          {d.toLocaleDateString("en-US", { weekday: "short" })}
                        </div>
                        <div
                          className={cn(
                            "mx-auto mt-1 flex size-10 items-center justify-center rounded-full text-2xl font-normal",
                            today && "bg-primary text-primary-foreground"
                          )}
                        >
                          {d.getDate()}
                        </div>
                        {coverage && (
                          // Fixed-height slot so headers don't jump when a pill appears.
                          <div className="mt-1 flex h-5 items-center justify-center">
                            {shortfall > 0 && (
                              <span
                                className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                                title={`${shortfall} understaffed ${shortfall === 1 ? "hour" : "hours"}`}
                              >
                                -{shortfall}h
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )
                    return (
                      <TableHead
                        key={d.getTime()}
                        className={cn(
                          "h-auto border-l border-border/60 bg-background px-1 py-2 text-center",
                          selectedDay === dayIndex &&
                            "bg-primary/5 shadow-[inset_0_-2px_0_var(--color-primary)]"
                        )}
                      >
                        {coverage ? (
                          <button
                            type="button"
                            onClick={() => onSelectDay?.(dayIndex)}
                            aria-pressed={selectedDay === dayIndex}
                            aria-label={`${d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })}, show hourly coverage`}
                            className="w-full rounded-lg py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                          >
                            {header}
                          </button>
                        ) : (
                          <div className="py-1">{header}</div>
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              </TableHeader>
            </Table>
          </div>
          <div className={cn("min-h-0 flex-1 overflow-y-auto", gutter)}>
            <Table className={tableClass}>
              <GridColumns />
              <TableBody>
                {staff.map((person) => (
                  <TableRow
                    key={person.id}
                    className="align-top hover:bg-transparent has-aria-expanded:bg-transparent"
                  >
                    <TableCell className="group/employee font-medium whitespace-normal transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-base">
                            {person.name}
                          </div>
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
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${person.name}`}
                                  className="opacity-0 transition-opacity group-hover/employee:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
                                />
                              }
                            >
                              <MoreHorizontal />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onClick={() => onEditStaff(person)}
                              >
                                <Pencil /> Edit info
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onDeleteStaff(person)}
                              >
                                <Trash2 /> Delete employee
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </TableCell>
                    {days.map((_, dayIndex) => {
                      const hasOverlap = overlapCells.has(
                        `${person.id}|${dayIndex}`
                      )
                      return (
                        <TableCell
                          key={dayIndex}
                          title={
                            hasOverlap
                              ? "Overlapping shifts: fix before publishing"
                              : undefined
                          }
                          className={cn(
                            "group/cell border-l border-border/60 transition-colors hover:bg-muted/30 has-aria-expanded:bg-muted/30",
                            hasOverlap &&
                              "bg-destructive/10 hover:bg-destructive/15"
                          )}
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
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div
            className={cn(
              "overflow-y-hidden border-t border-border/60 bg-background",
              gutter
            )}
          >
            <Table className={tableClass}>
              <GridColumns />
              <TableBody>
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={days.length + 1} className="p-0">
                    <Button
                      variant="ghost"
                      className="h-14 w-full justify-start rounded-none px-4 text-base hover:bg-muted/45 dark:hover:bg-muted/30"
                      onClick={onAddStaff}
                    >
                      <Plus /> Add employee
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div
            className={cn(
              "overflow-y-hidden border-t border-border/60 bg-muted",
              gutter
            )}
          >
            <Table className={tableClass}>
              <GridColumns />
              <TableBody>
                <TableRow className="border-0 bg-muted font-medium hover:bg-muted">
                  <TableCell className="py-2">
                    <div>Total assigned hours</div>
                    <div className="text-xs font-normal text-muted-foreground">
                      {weekTotal}h
                    </div>
                  </TableCell>
                  {dailyTotals.map((hours, i) => (
                    <TableCell
                      key={i}
                      className={cn(
                        "border-l border-border/60 py-2 text-center",
                        hours === 0 && "text-muted-foreground"
                      )}
                    >
                      {hours}h
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Shared column widths so the header, body and footer tables line up. */
function GridColumns() {
  return (
    <colgroup>
      <col className="w-44" />
      {Array.from({ length: 7 }, (_, i) => (
        <col key={i} />
      ))}
    </colgroup>
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
      {assigned}h / {max}h
    </div>
  )
}

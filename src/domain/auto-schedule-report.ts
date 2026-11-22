import type { AutoScheduleResult } from "./auto-schedule"
import type { DayOfWeek, Staff } from "./types"

export interface UnstaffedRange {
  dayOfWeek: DayOfWeek
  /** Clock hours, e.g. start 21 and end 23 means 21:00–23:00. */
  startHour: number
  endHour: number
}

export interface OverMaxLine {
  name: string
  hours: number
  maxWeeklyHours: number
}

export interface AutoScheduleSummary {
  assignmentCount: number
  /** Consecutive hours with transactions but no staff, merged per day. */
  unstaffed: UnstaffedRange[]
  /** Employees scheduled over their maximum weekly hours to cover hours with transactions. */
  overMax: OverMaxLine[]
  notes: string[]
}

const pad = (n: number) => String(n).padStart(2, "0")
export const formatRange = (r: UnstaffedRange) =>
  `${pad(r.startHour)}:00–${pad(r.endHour)}:00`

/**
 * User-facing summary of a generated roster. Understaffing means "transactions but nobody
 * staffed" only: no productivity target is assumed.
 */
export function summarizeAutoSchedule(
  result: AutoScheduleResult,
  staff: Pick<Staff, "id" | "name">[] = []
): AutoScheduleSummary {
  const sorted = [...result.unstaffedHours].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour
  )
  const unstaffed: UnstaffedRange[] = []
  for (const u of sorted) {
    const last = unstaffed[unstaffed.length - 1]
    if (last && last.dayOfWeek === u.dayOfWeek && last.endHour === u.hour) {
      last.endHour = u.hour + 1
    } else {
      unstaffed.push({
        dayOfWeek: u.dayOfWeek,
        startHour: u.hour,
        endHour: u.hour + 1,
      })
    }
  }
  return {
    assignmentCount: result.assignments.length,
    unstaffed,
    overMax: result.overMaxStaff.map((o) => ({
      name: staff.find((s) => s.id === o.staffId)?.name ?? o.staffId,
      hours: o.hours,
      maxWeeklyHours: o.maxWeeklyHours,
    })),
    notes: result.notes,
  }
}

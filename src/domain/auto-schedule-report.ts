import type { AutoScheduleResult } from "./auto-schedule"
import type { DayOfWeek } from "./types"

export interface UnderstaffedRange {
  dayOfWeek: DayOfWeek
  /** Clock hours, e.g. start 21 and end 23 means 21:00–23:00. */
  startHour: number
  endHour: number
  /** Staff these hours need (at the configured transactions per staff hour) and what the roster has. */
  required: number
  staffed: number
}

export interface AutoScheduleSummary {
  assignmentCount: number
  /** Transactions per employee-hour the staffing requirement was based on. */
  transactionsPerStaffHour: number
  /** Consecutive hours with the same shortfall, merged per day. */
  understaffed: UnderstaffedRange[]
  understaffedStaffHours: number
  notes: string[]
}

const pad = (n: number) => String(n).padStart(2, "0")
export const formatRange = (
  r: Pick<UnderstaffedRange, "startHour" | "endHour">
) => `${pad(r.startHour)}:00–${pad(r.endHour)}:00`

/** Manager-facing summary of a generated roster. Maximum hours are never exceeded. */
export function summarizeAutoSchedule(
  result: AutoScheduleResult
): AutoScheduleSummary {
  const sorted = [...result.shortfalls].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || a.hour - b.hour
  )
  const understaffed: UnderstaffedRange[] = []
  for (const s of sorted) {
    const last = understaffed[understaffed.length - 1]
    if (
      last &&
      last.dayOfWeek === s.dayOfWeek &&
      last.endHour === s.hour &&
      last.required === s.required &&
      last.staffed === s.staffed
    ) {
      last.endHour = s.hour + 1
    } else {
      understaffed.push({
        dayOfWeek: s.dayOfWeek,
        startHour: s.hour,
        endHour: s.hour + 1,
        required: s.required,
        staffed: s.staffed,
      })
    }
  }
  return {
    assignmentCount: result.assignments.length,
    transactionsPerStaffHour: result.transactionsPerStaffHour,
    understaffed,
    understaffedStaffHours: result.understaffedStaffHours,
    notes: result.notes,
  }
}

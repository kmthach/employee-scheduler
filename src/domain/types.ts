/** Day of week: Monday = 0 ... Sunday = 6. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface Staff {
  id: string
  scheduleId: string
  name: string
  maxWeeklyHours: number
}

export interface Shift {
  id: string
  scheduleId: string
  startTime: string // HH:mm
  endTime: string // HH:mm
}

export interface Assignment {
  id: string
  scheduleId: string
  staffId: string
  shiftId: string
  dayOfWeek: DayOfWeek
}

export type ScheduleStatus = "draft" | "published"

export interface Schedule {
  id: string // Monday date, YYYY-MM-DD
  /** "draft" until published; a published schedule returns to "draft" on its first change. */
  status: ScheduleStatus
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

/** The editable rows a schedule owns (what a draft copy / published snapshot holds). */
export interface ScheduleContent {
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
}

export interface TransactionRecord {
  id: string
  scheduleId: string
  dayOfWeek: DayOfWeek
  hour: number // 0–23
  transactionCount: number
}

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

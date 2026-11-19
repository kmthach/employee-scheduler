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

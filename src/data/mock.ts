import type { Assignment, DayOfWeek, Shift, Staff } from "@/domain/types"

export interface ScheduleData {
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
}

/** Builds sample data owned by `scheduleId`. IDs are namespaced so they stay unique across schedules. */
export function createMockData(scheduleId: string): ScheduleData {
  const id = (name: string) => `${scheduleId}:${name}`

  const staff: Staff[] = [
    { id: id("staff-1"), scheduleId, name: "Alex Rivera", maxWeeklyHours: 40 },
    { id: id("staff-2"), scheduleId, name: "Sam Chen", maxWeeklyHours: 24 },
  ]

  const shifts: Shift[] = [
    { id: id("shift-morning"), scheduleId, startTime: "07:00", endTime: "15:00" },
    { id: id("shift-evening"), scheduleId, startTime: "15:00", endTime: "23:00" },
  ]

  const [alex, sam] = staff.map((s) => s.id)
  const [morning, evening] = shifts.map((s) => s.id)
  const rows: [string, string, DayOfWeek][] = [
    [alex, morning, 0],
    [alex, morning, 1],
    [sam, evening, 1],
    [alex, evening, 3],
    [sam, morning, 3],
    [alex, morning, 5],
    [sam, evening, 5],
  ]
  const assignments: Assignment[] = rows.map(([staffId, shiftId, dayOfWeek], i) => ({
    id: id(`assignment-${i + 1}`),
    scheduleId,
    staffId,
    shiftId,
    dayOfWeek,
  }))

  return { staff, shifts, assignments }
}

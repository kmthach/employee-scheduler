import { getScheduleId, parseScheduleId } from "./date"
import type { Schedule, Shift } from "./types"

export const DEFAULT_SHIFT_TIMES = [
  { startTime: "07:00", endTime: "15:00" },
  { startTime: "15:00", endTime: "23:00" },
] as const

/** True if the ID is a valid `YYYY-MM-DD` date that falls on a Monday. */
export function isValidScheduleId(id: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return false
  return getScheduleId(parseScheduleId(id)) === id
}

/** Creates a schedule seeded with the default shift templates. */
export function createSchedule(
  scheduleId: string,
  now: Date,
  newId: () => string
): { schedule: Schedule; shifts: Shift[] } {
  if (!isValidScheduleId(scheduleId)) {
    throw new Error(`Invalid schedule ID: ${scheduleId}`)
  }
  const timestamp = now.toISOString()
  return {
    schedule: { id: scheduleId, status: "draft", createdAt: timestamp, updatedAt: timestamp },
    shifts: DEFAULT_SHIFT_TIMES.map((t) => ({ id: newId(), scheduleId, ...t })),
  }
}

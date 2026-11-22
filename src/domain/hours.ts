import { shiftDurationHours } from "./time"
import type { Assignment, Shift } from "./types"

/** Total hours assigned to an employee. Pass one schedule's assignments and shifts. */
export function getAssignedHours(
  staffId: string,
  assignments: Assignment[],
  shifts: Shift[]
): number {
  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  let total = 0
  for (const a of assignments) {
    if (a.staffId !== staffId) continue
    const shift = shiftById.get(a.shiftId)
    if (shift) total += shiftDurationHours(shift)
  }
  return total
}

export type HoursStatus = "ok" | "at-max" | "over"

const toMinutes = (hours: number) => Math.round(hours * 60)

/** True when `assigned` hours are above `max` hours (compared in whole minutes, no float drift). */
export function exceedsMax(assigned: number, max: number): boolean {
  return toMinutes(assigned) > toMinutes(max)
}

/**
 * "over" = above the maximum. New assignments that would go over are refused; "over" can still
 * appear after a shift template or maximum-hours edit, and then blocks publishing.
 */
export function getHoursStatus(assigned: number, max: number): HoursStatus {
  if (exceedsMax(assigned, max)) return "over"
  if (toMinutes(assigned) === toMinutes(max)) return "at-max"
  return "ok"
}

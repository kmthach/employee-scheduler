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

/** Maximum hours are a warning threshold only; this never blocks anything. */
export function getHoursStatus(assigned: number, max: number): HoursStatus {
  if (assigned > max) return "over"
  if (assigned === max) return "at-max"
  return "ok"
}

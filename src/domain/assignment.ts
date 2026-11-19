import { getAssignedHours, getHoursStatus } from "./hours"
import { timesOverlap } from "./time"
import type { Assignment, DayOfWeek, Shift, Staff } from "./types"

export interface AssignmentCandidate {
  staffId: string
  shiftId: string
  dayOfWeek: DayOfWeek
}

export type AssignmentCheck =
  | { ok: true }
  | {
      ok: false
      reason: "missing-staff" | "missing-shift" | "wrong-schedule" | "overlap"
      conflictShiftId?: string
    }

/**
 * Checks ERD rules for an assignment: staff and shift exist in the same schedule and the
 * employee has no overlapping assignment that day. Exceeding max weekly hours is NOT checked here
 * (it is only a warning). `ignoreAssignmentId` skips the assignment being changed.
 */
export function checkAssignment(
  data: { staff: Staff[]; shifts: Shift[]; assignments: Assignment[] },
  candidate: AssignmentCandidate,
  ignoreAssignmentId?: string
): AssignmentCheck {
  const person = data.staff.find((s) => s.id === candidate.staffId)
  if (!person) return { ok: false, reason: "missing-staff" }
  const shift = data.shifts.find((s) => s.id === candidate.shiftId)
  if (!shift) return { ok: false, reason: "missing-shift" }
  if (person.scheduleId !== shift.scheduleId) return { ok: false, reason: "wrong-schedule" }

  for (const a of data.assignments) {
    if (a.id === ignoreAssignmentId) continue
    if (a.staffId !== candidate.staffId || a.dayOfWeek !== candidate.dayOfWeek) continue
    const other = data.shifts.find((s) => s.id === a.shiftId)
    if (other && timesOverlap(shift, other)) {
      return { ok: false, reason: "overlap", conflictShiftId: other.id }
    }
  }
  return { ok: true }
}

/** Short human-readable explanation for a blocked assignment. */
export function describeBlock(check: AssignmentCheck, shifts: Shift[]): string {
  if (check.ok) return ""
  switch (check.reason) {
    case "overlap": {
      const other = shifts.find((s) => s.id === check.conflictShiftId)
      return other ? `Overlaps ${other.startTime}–${other.endTime}` : "Overlaps another shift"
    }
    case "missing-staff":
      return "Employee no longer exists"
    case "missing-shift":
      return "Shift no longer exists"
    case "wrong-schedule":
      return "Employee and shift belong to different schedules"
  }
}

export function addAssignment(
  assignments: Assignment[],
  scheduleId: string,
  candidate: AssignmentCandidate,
  id: string
): Assignment[] {
  return [...assignments, { id, scheduleId, ...candidate }]
}

export function updateAssignment(
  assignments: Assignment[],
  id: string,
  patch: Partial<Pick<Assignment, "staffId" | "shiftId">>
): Assignment[] {
  return assignments.map((a) => (a.id === id ? { ...a, ...patch } : a))
}

export function removeAssignment(assignments: Assignment[], id: string): Assignment[] {
  return assignments.filter((a) => a.id !== id)
}

/** Employees whose assigned hours exceed their maximum (a warning list, not a restriction). */
export function getOverMaxStaff(
  staff: Staff[],
  assignments: Assignment[],
  shifts: Shift[]
): { staff: Staff; assigned: number }[] {
  return staff
    .map((s) => ({ staff: s, assigned: getAssignedHours(s.id, assignments, shifts) }))
    .filter((x) => getHoursStatus(x.assigned, x.staff.maxWeeklyHours) === "over")
}

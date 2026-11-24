import { exceedsMax, getAssignedHours, getHoursStatus } from "./hours"
import { shiftDurationHours, timesOverlap } from "./time"
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
      reason:
        | "missing-staff"
        | "missing-shift"
        | "wrong-schedule"
        | "overlap"
        | "duplicate"
        | "over-max"
      conflictShiftId?: string
      /** For "over-max": the employee's hours with this assignment, and their maximum. */
      overMax?: { staffName: string; hours: number; maxWeeklyHours: number }
    }

/**
 * Checks the rules for an assignment: staff and shift exist in the same schedule, the employee
 * has no overlapping assignment that day, and the assignment would not take them above their
 * maximum weekly hours. `ignoreAssignmentId` skips the assignment being changed (its hours are
 * not counted either).
 */
export function checkAssignment(
  data: { staff: Staff[]; shifts: Shift[]; assignments: Assignment[] },
  candidate: AssignmentCandidate,
  ignoreAssignmentId?: string,
  /** Restoring a removed assignment may overlap; that is reported at publish time instead. */
  options: { allowOverlap?: boolean } = {}
): AssignmentCheck {
  const person = data.staff.find((s) => s.id === candidate.staffId)
  if (!person) return { ok: false, reason: "missing-staff" }
  const shift = data.shifts.find((s) => s.id === candidate.shiftId)
  if (!shift) return { ok: false, reason: "missing-shift" }
  if (person.scheduleId !== shift.scheduleId)
    return { ok: false, reason: "wrong-schedule" }

  for (const a of data.assignments) {
    if (a.id === ignoreAssignmentId) continue
    if (a.staffId !== candidate.staffId || a.dayOfWeek !== candidate.dayOfWeek)
      continue
    const other = data.shifts.find((s) => s.id === a.shiftId)
    if (other && other.id === shift.id) {
      return { ok: false, reason: "duplicate", conflictShiftId: other.id }
    }
    if (other && !options.allowOverlap && timesOverlap(shift, other)) {
      return { ok: false, reason: "overlap", conflictShiftId: other.id }
    }
  }

  const others = data.assignments.filter((a) => a.id !== ignoreAssignmentId)
  const hours =
    getAssignedHours(person.id, others, data.shifts) + shiftDurationHours(shift)
  if (exceedsMax(hours, person.maxWeeklyHours)) {
    return {
      ok: false,
      reason: "over-max",
      overMax: {
        staffName: person.name,
        hours,
        maxWeeklyHours: person.maxWeeklyHours,
      },
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
      return other
        ? `Overlaps the ${other.startTime}–${other.endTime} shift`
        : "Overlaps another shift"
    }
    case "duplicate":
      return "Already on this shift"
    case "over-max":
      return check.overMax
        ? `${check.overMax.staffName} would reach ${check.overMax.hours}h (limit ${check.overMax.maxWeeklyHours}h)`
        : "Would go over the hour limit"
    case "missing-staff":
      return "This employee was removed"
    case "missing-shift":
      return "This shift was removed"
    case "wrong-schedule":
      return "Employee and shift are from different weeks"
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

export function removeAssignment(
  assignments: Assignment[],
  id: string
): Assignment[] {
  return assignments.filter((a) => a.id !== id)
}

/** Employees whose assigned hours exceed their maximum (only possible after an edit; blocks publishing). */
export function getOverMaxStaff(
  staff: Staff[],
  assignments: Assignment[],
  shifts: Shift[]
): { staff: Staff; assigned: number }[] {
  return staff
    .map((s) => ({
      staff: s,
      assigned: getAssignedHours(s.id, assignments, shifts),
    }))
    .filter(
      (x) => getHoursStatus(x.assigned, x.staff.maxWeeklyHours) === "over"
    )
}

/** Replaces every assignment of one schedule with `candidates`; other schedules are untouched. */
export function replaceAssignments(
  assignments: Assignment[],
  scheduleId: string,
  candidates: AssignmentCandidate[],
  makeId: () => string
): Assignment[] {
  return [
    ...assignments.filter((a) => a.scheduleId !== scheduleId),
    ...candidates.map((c) => ({ id: makeId(), scheduleId, ...c })),
  ]
}

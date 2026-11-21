import { parseTime, timesOverlap } from "./time"
import type { Assignment, DayOfWeek, Shift, Staff } from "./types"

export interface ShiftInput {
  startTime: string
  endTime: string
}

export interface ShiftValidation {
  ok: boolean
  errors: { startTime?: string; endTime?: string; form?: string }
}

export interface OverlapConflict {
  staffId: string
  dayOfWeek: DayOfWeek
  shiftIds: [string, string]
}

export function sortShifts<T extends Pick<Shift, "startTime" | "endTime">>(
  shifts: T[]
): T[] {
  return [...shifts].sort(
    (a, b) =>
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime)
  )
}

/** Validates times and rejects exact duplicates. `editingId` excludes the shift being edited. */
export function validateShiftInput(
  input: ShiftInput,
  existing: Shift[],
  editingId?: string
): ShiftValidation {
  const errors: ShiftValidation["errors"] = {}
  const start = parseTime(input.startTime)
  const end = parseTime(input.endTime)

  if (start === null) errors.startTime = "Enter a start time."
  if (end === null) errors.endTime = "Enter an end time."
  if (start !== null && end !== null && end <= start) {
    errors.endTime =
      end === start
        ? "End time must be after the start time."
        : "End time must be after the start time. Overnight shifts aren't supported."
  }

  if (Object.keys(errors).length === 0) {
    const duplicate = existing.some(
      (s) =>
        s.id !== editingId &&
        s.startTime === input.startTime &&
        s.endTime === input.endTime
    )
    if (duplicate) errors.form = "A shift with these times already exists."
  }
  return { ok: Object.keys(errors).length === 0, errors }
}

export function addShift(
  shifts: Shift[],
  scheduleId: string,
  input: ShiftInput,
  id: string
): Shift[] {
  return [
    ...shifts,
    { id, scheduleId, startTime: input.startTime, endTime: input.endTime },
  ]
}

export function updateShift(
  shifts: Shift[],
  id: string,
  input: ShiftInput
): Shift[] {
  return shifts.map((s) =>
    s.id === id
      ? { ...s, startTime: input.startTime, endTime: input.endTime }
      : s
  )
}

/** Removes a shift template and every assignment that uses it. */
export function removeShift(
  shifts: Shift[],
  assignments: Assignment[],
  id: string
): { shifts: Shift[]; assignments: Assignment[] } {
  return {
    shifts: shifts.filter((s) => s.id !== id),
    assignments: assignments.filter((a) => a.shiftId !== id),
  }
}

export function getShiftUsage(
  assignments: Assignment[],
  shiftId: string
): number {
  return assignments.filter((a) => a.shiftId === shiftId).length
}

/** Roster cells (`"staffId|dayOfWeek"`) that contain overlapping assignments. */
export function overlapCellKeys(conflicts: OverlapConflict[]): Set<string> {
  return new Set(conflicts.map((c) => `${c.staffId}|${c.dayOfWeek}`))
}

/** Finds employee/day pairs whose assigned shifts overlap in time. */
export function findOverlapConflicts(
  shifts: Shift[],
  assignments: Assignment[]
): OverlapConflict[] {
  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  const groups = new Map<string, Assignment[]>()
  for (const a of assignments) {
    const key = `${a.staffId}|${a.dayOfWeek}`
    groups.set(key, [...(groups.get(key) ?? []), a])
  }

  const conflicts: OverlapConflict[] = []
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = shiftById.get(group[i].shiftId)
        const b = shiftById.get(group[j].shiftId)
        if (a && b && timesOverlap(a, b)) {
          conflicts.push({
            staffId: group[i].staffId,
            dayOfWeek: group[i].dayOfWeek,
            shiftIds: [a.id, b.id],
          })
        }
      }
    }
  }
  return conflicts
}

export interface ShiftUpdateValidation extends ShiftValidation {
  conflicts: OverlapConflict[]
}

/**
 * Validates an edit. Overlaps the edit would create are NOT rejected: they are returned in
 * `conflicts` so the roster can highlight them; publishing is blocked until they are resolved.
 */
export function validateShiftUpdate(
  shifts: Shift[],
  assignments: Assignment[],
  id: string,
  input: ShiftInput
): ShiftUpdateValidation {
  const base = validateShiftInput(input, shifts, id)
  if (!base.ok) return { ...base, conflicts: [] }

  // Only conflicts involving the edited shift are caused by this edit.
  const caused = findOverlapConflicts(
    updateShift(shifts, id, input),
    assignments
  ).filter((c) => c.shiftIds.includes(id))
  return { ...base, conflicts: caused }
}

export function describeConflict(
  conflict: OverlapConflict,
  staff: Staff[],
  dayNames: readonly string[]
): string {
  const name =
    staff.find((s) => s.id === conflict.staffId)?.name ?? "An employee"
  return `${name} would have overlapping shifts on ${dayNames[conflict.dayOfWeek]}.`
}

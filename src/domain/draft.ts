import { getOverMaxStaff } from "./assignment"
import { findOverlapConflicts } from "./shift"
import type { OverlapConflict } from "./shift"
import type { Assignment, ScheduleContent, Staff } from "./types"

/** Copies out the rows owned by one schedule. */
export function getContent(
  all: ScheduleContent,
  scheduleId: string
): ScheduleContent {
  return {
    staff: all.staff.filter((x) => x.scheduleId === scheduleId),
    shifts: all.shifts.filter((x) => x.scheduleId === scheduleId),
    assignments: all.assignments.filter((x) => x.scheduleId === scheduleId),
  }
}

/** Swaps one schedule's rows for `content`, leaving every other schedule untouched. */
export function replaceContent(
  all: ScheduleContent,
  scheduleId: string,
  content: ScheduleContent
): ScheduleContent {
  const others = <T extends { scheduleId: string }>(rows: T[]) =>
    rows.filter((x) => x.scheduleId !== scheduleId)
  return {
    staff: [...others(all.staff), ...content.staff],
    shifts: [...others(all.shifts), ...content.shifts],
    assignments: [...others(all.assignments), ...content.assignments],
  }
}

export interface PublishValidation {
  /** Overlapping assignments and employees over their maximum hours block publishing. */
  ok: boolean
  conflicts: OverlapConflict[]
  /** Employees over their maximum weekly hours (possible after a template or maximum edit). */
  overMax: { staff: Staff; assigned: number }[]
}

export function validateForPublish(
  content: ScheduleContent
): PublishValidation {
  const conflicts = findOverlapConflicts(content.shifts, content.assignments)
  const overMax = getOverMaxStaff(
    content.staff,
    content.assignments,
    content.shifts
  )
  return {
    ok: conflicts.length === 0 && overMax.length === 0,
    conflicts,
    overMax,
  }
}

export const assignmentKey = (
  a: Pick<Assignment, "staffId" | "dayOfWeek" | "shiftId">
) => `${a.staffId}|${a.dayOfWeek}|${a.shiftId}`

export interface AssignmentDiff {
  /** Published assignments no longer in the draft: shown as pending removal until publish. */
  removed: Assignment[]
  /** Keys (see `assignmentKey`) of draft assignments that are not published yet. */
  addedKeys: Set<string>
}

/**
 * Compares the published assignments with the working draft. Assignments are matched by
 * employee + day + shift, so changing an assignment's shift shows as one removal plus one addition.
 */
export function diffAssignments(
  published: Assignment[],
  working: Assignment[]
): AssignmentDiff {
  const publishedKeys = new Set(published.map(assignmentKey))
  const workingKeys = new Set(working.map(assignmentKey))
  return {
    removed: published.filter((a) => !workingKeys.has(assignmentKey(a))),
    addedKeys: new Set([...workingKeys].filter((k) => !publishedKeys.has(k))),
  }
}

/**
 * Whether the working draft differs from the published content. Employees and shifts are compared
 * by id and values, assignments by employee + day + shift (so reverting every change reads as
 * "no changes").
 */
export function hasContentChanges(
  published: ScheduleContent,
  working: ScheduleContent
): boolean {
  const signature = (c: ScheduleContent) =>
    JSON.stringify({
      staff: c.staff.map((x) => `${x.id}|${x.name}|${x.maxWeeklyHours}`).sort(),
      shifts: c.shifts.map((x) => `${x.id}|${x.startTime}|${x.endTime}`).sort(),
      assignments: c.assignments.map(assignmentKey).sort(),
    })
  return signature(published) !== signature(working)
}

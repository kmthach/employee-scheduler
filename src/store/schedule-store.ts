import { create } from "zustand"

import { getScheduleId, moveWeek } from "@/domain/date"
import {
  addAssignment,
  checkAssignment,
  removeAssignment,
  replaceAssignments,
  updateAssignment,
} from "@/domain/assignment"
import type { AssignmentCandidate, AssignmentCheck } from "@/domain/assignment"
import { getContent, replaceContent, validateForPublish } from "@/domain/draft"
import type { PublishValidation } from "@/domain/draft"
import { createSchedule } from "@/domain/schedule"
import {
  addShift,
  removeShift,
  updateShift,
  validateShiftInput,
  validateShiftUpdate,
} from "@/domain/shift"
import type {
  OverlapConflict,
  ShiftInput,
  ShiftValidation,
} from "@/domain/shift"
import { addStaffBatch, removeStaff, updateStaff } from "@/domain/staff"
import type { StaffInput } from "@/domain/staff"
import type {
  Assignment,
  Schedule,
  ScheduleContent,
  Shift,
  Staff,
  TransactionRecord,
} from "@/domain/types"

export interface ShiftActionResult extends ShiftValidation {
  conflicts: OverlapConflict[]
}

interface ScheduleState {
  todayScheduleId: string
  currentScheduleId: string
  schedules: Schedule[]
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
  /**
   * The flat arrays above always hold the working version (the draft, if any). When a published
   * schedule has pending changes, its last published content is kept here until publish/discard.
   */
  publishedSnapshots: Record<string, ScheduleContent>
  /**
   * Assignments replaced by the last auto-schedule run, so it can be undone. Cleared by the next
   * change to any schedule (see `markChanged`), so Undo never overwrites later manual edits.
   */
  autoScheduleUndo: { scheduleId: string; assignments: Assignment[] } | null
  /** Demand data per schedule. Not roster content, so it is outside draft/publish snapshots. */
  transactions: TransactionRecord[]
  transactionReports: Record<string, TransactionReport>
  goToPreviousWeek: () => void
  goToNextWeek: () => void
  goToCurrentWeek: () => void
  /** Creates a schedule for the viewed week. No-op if one already exists. */
  createSchedule: () => void
  addStaffMany: (inputs: StaffInput[]) => void
  updateStaff: (id: string, input: StaffInput) => void
  deleteStaff: (id: string) => void
  /** Shift actions validate first and leave state untouched when `ok` is false. */
  addShift: (input: ShiftInput) => ShiftActionResult
  updateShift: (id: string, input: ShiftInput) => ShiftActionResult
  deleteShift: (id: string) => void
  /** Assignment actions re-check ERD rules and leave state untouched when `ok` is false. */
  assignShift: (candidate: AssignmentCandidate) => AssignmentCheck
  /** Re-adds a removed assignment. Unlike `assignShift` it may create an overlap (blocks publishing). */
  restoreAssignment: (candidate: AssignmentCandidate) => AssignmentCheck
  changeAssignmentShift: (id: string, shiftId: string) => AssignmentCheck
  removeAssignment: (id: string) => void
  /** Replaces the current schedule's transaction dataset. */
  saveTransactions: (
    records: TransactionRecord[],
    report: TransactionReport
  ) => void
  clearTransactions: () => void
  /**
   * Replaces the viewed week's assignments with generated ones (a published week becomes a
   * draft). The replaced assignments are kept for `undoAutoSchedule`.
   */
  applyGeneratedAssignments: (candidates: AssignmentCandidate[]) => void
  undoAutoSchedule: () => void
  /** Publishes the viewed week's draft. Blocked (state unchanged) while assignments overlap or employees exceed their maximum hours. */
  publishSchedule: () => PublishValidation
  /** Throws away pending changes to a published schedule, restoring its published content. */
  discardDraft: () => void
}

export interface TransactionReport {
  /** Source file name, or null when entered manually. */
  fileName: string | null
  reportRange?: string
  savedAt: string
}

const todayId = getScheduleId(new Date())

type State = Pick<
  ScheduleState,
  | "schedules"
  | "staff"
  | "shifts"
  | "assignments"
  | "publishedSnapshots"
  | "autoScheduleUndo"
>

/**
 * Marks a schedule as changed. The first change to a published schedule starts a draft: the
 * published content is snapshotted and the status returns to "draft".
 */
function markChanged(
  s: State,
  id: string
): Pick<State, "schedules" | "publishedSnapshots" | "autoScheduleUndo"> {
  const schedule = s.schedules.find((x) => x.id === id)
  const startsDraft =
    schedule?.status === "published" && !s.publishedSnapshots[id]
  const now = new Date().toISOString()
  return {
    autoScheduleUndo: null,
    schedules: s.schedules.map((x) =>
      x.id === id
        ? { ...x, updatedAt: now, status: startsDraft ? "draft" : x.status }
        : x
    ),
    publishedSnapshots: startsDraft
      ? { ...s.publishedSnapshots, [id]: getContent(s, id) }
      : s.publishedSnapshots,
  }
}

function withoutSnapshot(
  snapshots: Record<string, ScheduleContent>,
  id: string
): Record<string, ScheduleContent> {
  return Object.fromEntries(
    Object.entries(snapshots).filter(([key]) => key !== id)
  )
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  todayScheduleId: todayId,
  currentScheduleId: todayId,
  schedules: [],
  staff: [],
  shifts: [],
  assignments: [],
  publishedSnapshots: {},
  autoScheduleUndo: null,
  transactions: [],
  transactionReports: {},

  goToPreviousWeek: () =>
    set((s) => ({ currentScheduleId: moveWeek(s.currentScheduleId, -1) })),
  goToNextWeek: () =>
    set((s) => ({ currentScheduleId: moveWeek(s.currentScheduleId, 1) })),
  goToCurrentWeek: () => set((s) => ({ currentScheduleId: s.todayScheduleId })),

  createSchedule: () =>
    set((s) => {
      if (s.schedules.some((x) => x.id === s.currentScheduleId)) return s
      const created = createSchedule(s.currentScheduleId, new Date(), () =>
        crypto.randomUUID()
      )
      return {
        schedules: [...s.schedules, created.schedule],
        shifts: [...s.shifts, ...created.shifts],
      }
    }),

  addStaffMany: (inputs) =>
    set((s) => {
      if (
        inputs.length === 0 ||
        !s.schedules.some((x) => x.id === s.currentScheduleId)
      )
        return s
      return {
        staff: addStaffBatch(s.staff, s.currentScheduleId, inputs, () =>
          crypto.randomUUID()
        ),
        ...markChanged(s, s.currentScheduleId),
      }
    }),

  updateStaff: (id, input) =>
    set((s) => {
      const target = s.staff.find((x) => x.id === id)
      if (!target) return s
      return {
        staff: updateStaff(s.staff, id, input),
        ...markChanged(s, target.scheduleId),
      }
    }),

  deleteStaff: (id) =>
    set((s) => {
      const target = s.staff.find((x) => x.id === id)
      if (!target) return s
      const result = removeStaff(s.staff, s.assignments, id)
      return { ...result, ...markChanged(s, target.scheduleId) }
    }),

  addShift: (input) => {
    const s = get()
    const current = s.currentScheduleId
    if (!s.schedules.some((x) => x.id === current)) {
      return {
        ok: false,
        errors: { form: "There is no schedule for this week." },
        conflicts: [],
      }
    }
    const result = validateShiftInput(
      input,
      s.shifts.filter((x) => x.scheduleId === current)
    )
    if (!result.ok) return { ...result, conflicts: [] }
    set({
      shifts: addShift(s.shifts, current, input, crypto.randomUUID()),
      ...markChanged(s, current),
    })
    return { ...result, conflicts: [] }
  },

  updateShift: (id, input) => {
    const s = get()
    const target = s.shifts.find((x) => x.id === id)
    if (!target)
      return {
        ok: false,
        errors: { form: "This shift no longer exists." },
        conflicts: [],
      }
    const result = validateShiftUpdate(
      s.shifts.filter((x) => x.scheduleId === target.scheduleId),
      s.assignments.filter((a) => a.scheduleId === target.scheduleId),
      id,
      input
    )
    if (!result.ok) return result
    set({
      shifts: updateShift(s.shifts, id, input),
      ...markChanged(s, target.scheduleId),
    })
    return result
  },

  deleteShift: (id) =>
    set((s) => {
      const target = s.shifts.find((x) => x.id === id)
      if (!target) return s
      const result = removeShift(s.shifts, s.assignments, id)
      return { ...result, ...markChanged(s, target.scheduleId) }
    }),

  assignShift: (candidate) => {
    const s = get()
    const current = s.currentScheduleId
    if (!s.schedules.some((x) => x.id === current))
      return { ok: false, reason: "missing-staff" }
    const scoped = {
      staff: s.staff.filter((x) => x.scheduleId === current),
      shifts: s.shifts.filter((x) => x.scheduleId === current),
      assignments: s.assignments.filter((x) => x.scheduleId === current),
    }
    const check = checkAssignment(scoped, candidate)
    if (!check.ok) return check
    set({
      assignments: addAssignment(
        s.assignments,
        current,
        candidate,
        crypto.randomUUID()
      ),
      ...markChanged(s, current),
    })
    return check
  },

  restoreAssignment: (candidate) => {
    const s = get()
    const current = s.currentScheduleId
    if (!s.schedules.some((x) => x.id === current))
      return { ok: false, reason: "missing-staff" }
    const scoped = {
      staff: s.staff.filter((x) => x.scheduleId === current),
      shifts: s.shifts.filter((x) => x.scheduleId === current),
      assignments: s.assignments.filter((x) => x.scheduleId === current),
    }
    const check = checkAssignment(scoped, candidate, undefined, {
      allowOverlap: true,
    })
    if (!check.ok) return check
    set({
      assignments: addAssignment(
        s.assignments,
        current,
        candidate,
        crypto.randomUUID()
      ),
      ...markChanged(s, current),
    })
    return check
  },

  changeAssignmentShift: (id, shiftId) => {
    const s = get()
    const target = s.assignments.find((a) => a.id === id)
    if (!target) return { ok: false, reason: "missing-shift" }
    const scoped = {
      staff: s.staff.filter((x) => x.scheduleId === target.scheduleId),
      shifts: s.shifts.filter((x) => x.scheduleId === target.scheduleId),
      assignments: s.assignments.filter(
        (x) => x.scheduleId === target.scheduleId
      ),
    }
    const check = checkAssignment(
      scoped,
      { staffId: target.staffId, shiftId, dayOfWeek: target.dayOfWeek },
      id
    )
    if (!check.ok) return check
    set({
      assignments: updateAssignment(s.assignments, id, { shiftId }),
      ...markChanged(s, target.scheduleId),
    })
    return check
  },

  removeAssignment: (id) =>
    set((s) => {
      const target = s.assignments.find((a) => a.id === id)
      if (!target) return s
      return {
        assignments: removeAssignment(s.assignments, id),
        ...markChanged(s, target.scheduleId),
      }
    }),

  applyGeneratedAssignments: (candidates) =>
    set((s) => {
      const id = s.currentScheduleId
      if (!s.schedules.some((x) => x.id === id)) return s
      return {
        ...markChanged(s, id),
        assignments: replaceAssignments(s.assignments, id, candidates, () =>
          crypto.randomUUID()
        ),
        autoScheduleUndo: {
          scheduleId: id,
          assignments: s.assignments.filter((a) => a.scheduleId === id),
        },
      }
    }),

  undoAutoSchedule: () =>
    set((s) => {
      const undo = s.autoScheduleUndo
      if (!undo) return s
      return {
        ...markChanged(s, undo.scheduleId),
        assignments: [
          ...s.assignments.filter((a) => a.scheduleId !== undo.scheduleId),
          ...undo.assignments,
        ],
        autoScheduleUndo: null,
      }
    }),

  saveTransactions: (records, report) =>
    set((s) => {
      const id = s.currentScheduleId
      if (!s.schedules.some((x) => x.id === id)) return s
      return {
        transactions: [
          ...s.transactions.filter((t) => t.scheduleId !== id),
          ...records.filter((t) => t.scheduleId === id),
        ],
        transactionReports: { ...s.transactionReports, [id]: report },
      }
    }),

  clearTransactions: () =>
    set((s) => ({
      transactions: s.transactions.filter(
        (t) => t.scheduleId !== s.currentScheduleId
      ),
      transactionReports: Object.fromEntries(
        Object.entries(s.transactionReports).filter(
          ([key]) => key !== s.currentScheduleId
        )
      ),
    })),

  publishSchedule: () => {
    const s = get()
    const id = s.currentScheduleId
    const content = getContent(s, id)
    const result = validateForPublish(content)
    if (!result.ok || !s.schedules.some((x) => x.id === id))
      return { ...result, ok: false }
    set({
      publishedSnapshots: withoutSnapshot(s.publishedSnapshots, id),
      schedules: s.schedules.map((x) =>
        x.id === id
          ? { ...x, status: "published", updatedAt: new Date().toISOString() }
          : x
      ),
    })
    return result
  },

  discardDraft: () =>
    set((s) => {
      const id = s.currentScheduleId
      const snapshot = s.publishedSnapshots[id]
      if (!snapshot) return s
      return {
        ...replaceContent(s, id, snapshot),
        publishedSnapshots: withoutSnapshot(s.publishedSnapshots, id),
        schedules: s.schedules.map((x) =>
          x.id === id
            ? { ...x, status: "published", updatedAt: new Date().toISOString() }
            : x
        ),
      }
    }),
}))

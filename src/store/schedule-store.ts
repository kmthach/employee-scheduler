import { create } from "zustand"

import { getScheduleId, moveWeek } from "@/domain/date"
import {
  addAssignment,
  checkAssignment,
  removeAssignment,
  updateAssignment,
} from "@/domain/assignment"
import type { AssignmentCandidate, AssignmentCheck } from "@/domain/assignment"
import { createSchedule } from "@/domain/schedule"
import {
  addShift,
  removeShift,
  updateShift,
  validateShiftInput,
  validateShiftUpdate,
} from "@/domain/shift"
import type { OverlapConflict, ShiftInput, ShiftValidation } from "@/domain/shift"
import { addStaffBatch, removeStaff, updateStaff } from "@/domain/staff"
import type { StaffInput } from "@/domain/staff"
import type { Assignment, Schedule, Shift, Staff } from "@/domain/types"

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
  changeAssignmentShift: (id: string, shiftId: string) => AssignmentCheck
  removeAssignment: (id: string) => void
}

const todayId = getScheduleId(new Date())

const touch = (schedules: Schedule[], id: string): Schedule[] =>
  schedules.map((s) => (s.id === id ? { ...s, updatedAt: new Date().toISOString() } : s))

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  todayScheduleId: todayId,
  currentScheduleId: todayId,
  schedules: [],
  staff: [],
  shifts: [],
  assignments: [],

  goToPreviousWeek: () =>
    set((s) => ({ currentScheduleId: moveWeek(s.currentScheduleId, -1) })),
  goToNextWeek: () =>
    set((s) => ({ currentScheduleId: moveWeek(s.currentScheduleId, 1) })),
  goToCurrentWeek: () => set((s) => ({ currentScheduleId: s.todayScheduleId })),

  createSchedule: () =>
    set((s) => {
      if (s.schedules.some((x) => x.id === s.currentScheduleId)) return s
      const created = createSchedule(s.currentScheduleId, new Date(), () => crypto.randomUUID())
      return {
        schedules: [...s.schedules, created.schedule],
        shifts: [...s.shifts, ...created.shifts],
      }
    }),

  addStaffMany: (inputs) =>
    set((s) => {
      if (inputs.length === 0 || !s.schedules.some((x) => x.id === s.currentScheduleId)) return s
      return {
        staff: addStaffBatch(s.staff, s.currentScheduleId, inputs, () => crypto.randomUUID()),
        schedules: touch(s.schedules, s.currentScheduleId),
      }
    }),

  updateStaff: (id, input) =>
    set((s) => {
      const target = s.staff.find((x) => x.id === id)
      if (!target) return s
      return {
        staff: updateStaff(s.staff, id, input),
        schedules: touch(s.schedules, target.scheduleId),
      }
    }),

  deleteStaff: (id) =>
    set((s) => {
      const target = s.staff.find((x) => x.id === id)
      if (!target) return s
      const result = removeStaff(s.staff, s.assignments, id)
      return { ...result, schedules: touch(s.schedules, target.scheduleId) }
    }),

  addShift: (input) => {
    const s = get()
    const current = s.currentScheduleId
    if (!s.schedules.some((x) => x.id === current)) {
      return { ok: false, errors: { form: "There is no schedule for this week." }, conflicts: [] }
    }
    const result = validateShiftInput(input, s.shifts.filter((x) => x.scheduleId === current))
    if (!result.ok) return { ...result, conflicts: [] }
    set({
      shifts: addShift(s.shifts, current, input, crypto.randomUUID()),
      schedules: touch(s.schedules, current),
    })
    return { ...result, conflicts: [] }
  },

  updateShift: (id, input) => {
    const s = get()
    const target = s.shifts.find((x) => x.id === id)
    if (!target) return { ok: false, errors: { form: "This shift no longer exists." }, conflicts: [] }
    const result = validateShiftUpdate(
      s.shifts.filter((x) => x.scheduleId === target.scheduleId),
      s.assignments.filter((a) => a.scheduleId === target.scheduleId),
      id,
      input
    )
    if (!result.ok) return result
    set({
      shifts: updateShift(s.shifts, id, input),
      schedules: touch(s.schedules, target.scheduleId),
    })
    return result
  },

  deleteShift: (id) =>
    set((s) => {
      const target = s.shifts.find((x) => x.id === id)
      if (!target) return s
      const result = removeShift(s.shifts, s.assignments, id)
      return { ...result, schedules: touch(s.schedules, target.scheduleId) }
    }),

  assignShift: (candidate) => {
    const s = get()
    const current = s.currentScheduleId
    if (!s.schedules.some((x) => x.id === current)) return { ok: false, reason: "missing-staff" }
    const scoped = {
      staff: s.staff.filter((x) => x.scheduleId === current),
      shifts: s.shifts.filter((x) => x.scheduleId === current),
      assignments: s.assignments.filter((x) => x.scheduleId === current),
    }
    const check = checkAssignment(scoped, candidate)
    if (!check.ok) return check
    set({
      assignments: addAssignment(s.assignments, current, candidate, crypto.randomUUID()),
      schedules: touch(s.schedules, current),
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
      assignments: s.assignments.filter((x) => x.scheduleId === target.scheduleId),
    }
    const check = checkAssignment(
      scoped,
      { staffId: target.staffId, shiftId, dayOfWeek: target.dayOfWeek },
      id
    )
    if (!check.ok) return check
    set({
      assignments: updateAssignment(s.assignments, id, { shiftId }),
      schedules: touch(s.schedules, target.scheduleId),
    })
    return check
  },

  removeAssignment: (id) =>
    set((s) => {
      const target = s.assignments.find((a) => a.id === id)
      if (!target) return s
      return {
        assignments: removeAssignment(s.assignments, id),
        schedules: touch(s.schedules, target.scheduleId),
      }
    }),
}))

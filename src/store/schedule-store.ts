import { create } from "zustand"

import { getScheduleId, moveWeek } from "@/domain/date"
import { createSchedule } from "@/domain/schedule"
import { addStaffBatch, removeStaff, updateStaff } from "@/domain/staff"
import type { StaffInput } from "@/domain/staff"
import type { Assignment, Schedule, Shift, Staff } from "@/domain/types"

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
}

const todayId = getScheduleId(new Date())

const touch = (schedules: Schedule[], id: string): Schedule[] =>
  schedules.map((s) => (s.id === id ? { ...s, updatedAt: new Date().toISOString() } : s))

export const useScheduleStore = create<ScheduleState>((set) => ({
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
}))

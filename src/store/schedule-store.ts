import { create } from "zustand"

import { createMockData } from "@/data/mock"
import { getScheduleId, moveWeek } from "@/domain/date"
import type { Assignment, Shift, Staff } from "@/domain/types"

interface ScheduleState {
  todayScheduleId: string
  currentScheduleId: string
  /** IDs of weeks that have a schedule. Navigation never adds to this. */
  existingScheduleIds: string[]
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
  goToPreviousWeek: () => void
  goToNextWeek: () => void
  goToCurrentWeek: () => void
}

const todayId = getScheduleId(new Date())
const initialData = createMockData(todayId)

export const useScheduleStore = create<ScheduleState>((set) => ({
  todayScheduleId: todayId,
  currentScheduleId: todayId,
  existingScheduleIds: [todayId],
  staff: initialData.staff,
  shifts: initialData.shifts,
  assignments: initialData.assignments,
  goToPreviousWeek: () =>
    set((s) => ({ currentScheduleId: moveWeek(s.currentScheduleId, -1) })),
  goToNextWeek: () =>
    set((s) => ({ currentScheduleId: moveWeek(s.currentScheduleId, 1) })),
  goToCurrentWeek: () => set((s) => ({ currentScheduleId: s.todayScheduleId })),
}))

import { describe, expect, it } from "vitest"

import type { AutoScheduleResult, Shortfall } from "./auto-schedule"
import { summarizeAutoSchedule } from "./auto-schedule-report"

const sf = (
  dayOfWeek: number,
  hour: number,
  required: number,
  staffed: number
) => ({ dayOfWeek, hour, required, staffed }) as Shortfall

const result = (
  shortfalls: Shortfall[],
  extra: Partial<AutoScheduleResult> = {}
): AutoScheduleResult => ({
  assignments: [{ staffId: "a", shiftId: "s", dayOfWeek: 0 }],
  status: "optimal",
  shortfalls,
  understaffing: shortfalls.reduce((n, s) => n + s.required - s.staffed, 0),
  understaffedStaffHours: shortfalls.reduce(
    (n, s) => n + s.required - s.staffed,
    0
  ),
  unstaffedHours: [],
  assignedMinutes: 0,
  fairnessSpread: 0,
  hoursByStaff: {},
  notes: [],
  ...extra,
})

describe("summarizeAutoSchedule", () => {
  it("merges consecutive hours with the same shortfall per day", () => {
    const s = summarizeAutoSchedule(
      result([
        sf(1, 22, 3, 1),
        sf(1, 20, 3, 1),
        sf(1, 21, 3, 1),
        sf(1, 23, 3, 2),
        sf(2, 9, 2, 0),
        sf(1, 7, 2, 1),
      ])
    )
    expect(s.understaffed).toEqual([
      { dayOfWeek: 1, startHour: 7, endHour: 8, required: 2, staffed: 1 },
      { dayOfWeek: 1, startHour: 20, endHour: 23, required: 3, staffed: 1 },
      { dayOfWeek: 1, startHour: 23, endHour: 24, required: 3, staffed: 2 },
      { dayOfWeek: 2, startHour: 9, endHour: 10, required: 2, staffed: 0 },
    ])
    expect(s.understaffedStaffHours).toBe(2 + 2 + 2 + 1 + 2 + 1)
  })

  it("does not merge across days", () => {
    const s = summarizeAutoSchedule(result([sf(0, 23, 2, 1), sf(1, 0, 2, 1)]))
    expect(s.understaffed).toHaveLength(2)
  })

  it("passes notes and counts through; nothing understaffed is empty", () => {
    const s = summarizeAutoSchedule(result([], { notes: ["note"] }))
    expect(s.understaffed).toEqual([])
    expect(s.understaffedStaffHours).toBe(0)
    expect(s.notes).toEqual(["note"])
    expect(s.assignmentCount).toBe(1)
  })
})

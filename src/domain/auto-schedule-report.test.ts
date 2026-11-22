import { describe, expect, it } from "vitest"

import type { AutoScheduleResult } from "./auto-schedule"
import { summarizeAutoSchedule } from "./auto-schedule-report"

const result = (
  unstaffed: [number, number][],
  extra: Partial<AutoScheduleResult> = {}
): AutoScheduleResult => ({
  assignments: [{ staffId: "a", shiftId: "s", dayOfWeek: 0 }],
  status: "optimal",
  unstaffedHours: unstaffed.map(([d, h]) => ({
    dayOfWeek: d as 0,
    hour: h,
    transactions: 5,
  })),
  shortfalls: [],
  surplusStaffHours: 0,
  hoursByStaff: {},
  overMaxStaff: [],
  notes: [],
  ...extra,
})

describe("summarizeAutoSchedule", () => {
  it("merges consecutive unstaffed hours per day", () => {
    const s = summarizeAutoSchedule(
      result([
        [1, 22],
        [1, 20],
        [1, 21],
        [2, 9],
        [1, 7],
      ])
    )
    expect(s.unstaffed).toEqual([
      { dayOfWeek: 1, startHour: 7, endHour: 8 },
      { dayOfWeek: 1, startHour: 20, endHour: 23 },
      { dayOfWeek: 2, startHour: 9, endHour: 10 },
    ])
  })

  it("does not merge across days and passes notes through", () => {
    const s = summarizeAutoSchedule(
      result(
        [
          [0, 23],
          [1, 0],
        ],
        { notes: ["note"] }
      )
    )
    expect(s.unstaffed).toHaveLength(2)
    expect(s.notes).toEqual(["note"])
    expect(s.assignmentCount).toBe(1)
  })

  it("has nothing to report when everything is staffed", () => {
    expect(summarizeAutoSchedule(result([])).unstaffed).toEqual([])
  })

  it("lists employees scheduled over their maximum by name", () => {
    const r = result([], {
      overMaxStaff: [
        { staffId: "a", hours: 44, maxWeeklyHours: 40, overHours: 4 },
      ],
    })
    expect(
      summarizeAutoSchedule(r, [{ id: "a", name: "Ana" }]).overMax
    ).toEqual([{ name: "Ana", hours: 44, maxWeeklyHours: 40 }])
  })
})

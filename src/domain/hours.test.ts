import { describe, expect, it } from "vitest"

import { getAssignedHours, getHoursStatus } from "./hours"
import type { Assignment, Shift } from "./types"

const shifts: Shift[] = [
  { id: "m", scheduleId: "s", startTime: "07:00", endTime: "15:00" },
  { id: "h", scheduleId: "s", startTime: "09:00", endTime: "12:30" },
]
const a = (id: string, staffId: string, shiftId: string, dayOfWeek: 0 | 1): Assignment => ({
  id,
  scheduleId: "s",
  staffId,
  shiftId,
  dayOfWeek,
})

describe("getAssignedHours", () => {
  it("is 0 with no assignments", () => {
    expect(getAssignedHours("x", [], shifts)).toBe(0)
  })
  it("sums durations including half hours and same-day shifts", () => {
    const list = [a("1", "x", "m", 0), a("2", "x", "h", 1), a("3", "y", "m", 0)]
    expect(getAssignedHours("x", list, shifts)).toBe(11.5)
    expect(getAssignedHours("y", list, shifts)).toBe(8)
  })
  it("ignores assignments whose shift is missing", () => {
    expect(getAssignedHours("x", [a("1", "x", "gone", 0)], shifts)).toBe(0)
  })
})

describe("getHoursStatus", () => {
  it("classifies hours against the maximum", () => {
    expect(getHoursStatus(23.5, 24)).toBe("ok")
    expect(getHoursStatus(24, 24)).toBe("at-max")
    expect(getHoursStatus(24.5, 24)).toBe("over")
  })
})

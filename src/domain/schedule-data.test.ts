import { describe, expect, it } from "vitest"

import { createMockData } from "@/data/mock"

import { filterBySchedule } from "./schedule-data"

describe("filterBySchedule", () => {
  it("isolates rows between schedules", () => {
    const a = createMockData("2026-11-16")
    const b = createMockData("2026-11-23")
    const staff = [...a.staff, ...b.staff]
    expect(filterBySchedule(staff, "2026-11-16")).toEqual(a.staff)
    expect(filterBySchedule(staff, "2026-11-30")).toEqual([])
  })
})

describe("createMockData", () => {
  const data = createMockData("2026-11-16")

  it("stamps every row with the schedule id", () => {
    const all = [...data.staff, ...data.shifts, ...data.assignments]
    expect(all.every((r) => r.scheduleId === "2026-11-16")).toBe(true)
  })

  it("keeps ids unique across schedules", () => {
    const other = createMockData("2026-11-23")
    const ids = new Set([...data.staff, ...other.staff].map((s) => s.id))
    expect(ids.size).toBe(4)
  })

  it("references staff and shifts from the same schedule", () => {
    const staffIds = new Set(data.staff.map((s) => s.id))
    const shiftIds = new Set(data.shifts.map((s) => s.id))
    expect(
      data.assignments.every((a) => staffIds.has(a.staffId) && shiftIds.has(a.shiftId))
    ).toBe(true)
  })

  it("has no overlapping assignments for one employee", () => {
    const keys = data.assignments.map((a) => {
      const shift = data.shifts.find((s) => s.id === a.shiftId)!
      return `${a.staffId}|${a.dayOfWeek}|${shift.startTime}`
    })
    expect(new Set(keys).size).toBe(keys.length)
  })
})

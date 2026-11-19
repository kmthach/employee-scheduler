import { describe, expect, it } from "vitest"

import { createSchedule, isValidScheduleId } from "./schedule"

describe("isValidScheduleId", () => {
  it("accepts Mondays", () => {
    expect(isValidScheduleId("2026-11-16")).toBe(true)
  })
  it("rejects non-Mondays, bad formats and impossible dates", () => {
    expect(isValidScheduleId("2026-11-17")).toBe(false)
    expect(isValidScheduleId("2026-11-1")).toBe(false)
    expect(isValidScheduleId("2026-02-30")).toBe(false)
    expect(isValidScheduleId("nope")).toBe(false)
  })
})

describe("createSchedule", () => {
  let n = 0
  const newId = () => `id-${++n}`
  const now = new Date("2026-11-19T10:00:00Z")

  it("seeds the default shifts scoped to the schedule", () => {
    const { schedule, shifts } = createSchedule("2026-11-16", now, newId)
    expect(schedule).toEqual({
      id: "2026-11-16",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    })
    expect(shifts.map((s) => [s.startTime, s.endTime])).toEqual([
      ["07:00", "15:00"],
      ["15:00", "23:00"],
    ])
    expect(shifts.every((s) => s.scheduleId === "2026-11-16")).toBe(true)
    expect(new Set(shifts.map((s) => s.id)).size).toBe(2)
  })
  it("throws for a non-Monday ID", () => {
    expect(() => createSchedule("2026-11-17", now, newId)).toThrow()
  })
})

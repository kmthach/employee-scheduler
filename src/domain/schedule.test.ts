import { describe, expect, it } from "vitest"

import {
  copyScheduleContent,
  createSchedule,
  findSourceScheduleId,
  getDefaultSetup,
  getSetupFromSource,
  isValidScheduleId,
} from "./schedule"

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
      status: "draft",
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

describe("findSourceScheduleId", () => {
  const ids = ["2026-11-02", "2026-11-16", "2026-12-07"]
  it("returns the nearest earlier schedule, across gaps", () => {
    expect(findSourceScheduleId(ids, "2026-11-23")).toBe("2026-11-16")
    expect(findSourceScheduleId(ids, "2026-12-28")).toBe("2026-12-07")
  })
  it("ignores the target itself and later weeks", () => {
    expect(findSourceScheduleId(ids, "2026-11-16")).toBe("2026-11-02")
  })
  it("returns null when nothing is earlier", () => {
    expect(findSourceScheduleId(ids, "2026-11-02")).toBeNull()
    expect(findSourceScheduleId([], "2026-11-02")).toBeNull()
  })
})

describe("createSchedule with a setup", () => {
  let n = 0
  const newId = () => `n-${++n}`
  const now = new Date("2026-11-19T10:00:00Z")

  it("builds shifts, employees and transactions for the new week", () => {
    const created = createSchedule("2026-11-23", now, newId, {
      shifts: [{ startTime: "09:00", endTime: "17:00" }],
      staff: [{ name: " Ana ", maxWeeklyHours: 30 }],
      transactions: [{ dayOfWeek: 0, hour: 8, transactionCount: 12 }],
    })
    expect(created.shifts).toHaveLength(1)
    expect(created.staff).toMatchObject([{ name: "Ana", maxWeeklyHours: 30 }])
    expect(created.transactions).toMatchObject([
      { dayOfWeek: 0, hour: 8, transactionCount: 12 },
    ])
    for (const row of [...created.shifts, ...created.staff, ...created.transactions])
      expect(row.scheduleId).toBe("2026-11-23")
  })
  it("default setup is the two default shifts and nothing else", () => {
    const setup = getDefaultSetup()
    expect(setup.shifts).toHaveLength(2)
    expect(setup.staff).toEqual([])
    expect(setup.transactions).toEqual([])
  })
})

describe("source rows", () => {
  const source = {
    staff: [{ id: "s1", scheduleId: "A", name: "Ana", maxWeeklyHours: 30 }],
    shifts: [{ id: "h1", scheduleId: "A", startTime: "07:00", endTime: "15:00" }],
    assignments: [
      { id: "a1", scheduleId: "A", staffId: "s1", shiftId: "h1", dayOfWeek: 2 as const },
    ],
    transactions: [
      { id: "t1", scheduleId: "A", dayOfWeek: 2 as const, hour: 9, transactionCount: 5 },
    ],
  }

  it("getSetupFromSource keeps times, employees and counts but not assignments", () => {
    const setup = getSetupFromSource(source)
    expect(setup.shifts).toEqual([{ startTime: "07:00", endTime: "15:00" }])
    expect(setup.staff).toEqual([{ name: "Ana", maxWeeklyHours: 30 }])
    expect(setup.transactions).toEqual([
      { dayOfWeek: 2, hour: 9, transactionCount: 5 },
    ])
  })

  it("copyScheduleContent clones with fresh ids and remapped assignments", () => {
    let n = 0
    const copy = copyScheduleContent(source, "B", () => `c-${++n}`)
    expect(copy.staff[0]).toMatchObject({ scheduleId: "B", name: "Ana" })
    expect(copy.staff[0].id).not.toBe("s1")
    expect(copy.assignments).toHaveLength(1)
    expect(copy.assignments[0]).toMatchObject({
      scheduleId: "B",
      staffId: copy.staff[0].id,
      shiftId: copy.shifts[0].id,
      dayOfWeek: 2,
    })
    const everyId = [
      ...copy.staff,
      ...copy.shifts,
      ...copy.assignments,
      ...copy.transactions,
    ]
    expect(everyId.every((r) => r.scheduleId === "B")).toBe(true)
    expect(new Set(everyId.map((r) => r.id)).size).toBe(everyId.length)
  })

  it("does not mutate the source", () => {
    const snapshot = JSON.stringify(source)
    copyScheduleContent(source, "B", () => crypto.randomUUID())
    expect(JSON.stringify(source)).toBe(snapshot)
  })
})

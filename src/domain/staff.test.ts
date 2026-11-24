import { describe, expect, it } from "vitest"

import {
  addStaff,
  addStaffBatch,
  removeStaff,
  updateStaff,
  validateStaffBatch,
  validateStaffInput,
} from "./staff"
import type { Assignment, Staff } from "./types"

describe("validateStaffInput", () => {
  it("accepts valid input", () => {
    expect(validateStaffInput({ name: " Alex ", maxWeeklyHours: 40 }).ok).toBe(
      true
    )
  })
  it("rejects empty or too-long names", () => {
    expect(
      validateStaffInput({ name: "  ", maxWeeklyHours: 40 }).errors.name
    ).toBeDefined()
    expect(
      validateStaffInput({ name: "x".repeat(61), maxWeeklyHours: 40 }).errors
        .name
    ).toBeDefined()
  })
  it("rejects invalid hours", () => {
    for (const h of [0, -5, 169, NaN, Infinity]) {
      expect(
        validateStaffInput({ name: "A", maxWeeklyHours: h }).errors
          .maxWeeklyHours
      ).toBeDefined()
    }
    expect(validateStaffInput({ name: "A", maxWeeklyHours: 168 }).ok).toBe(true)
  })
})

describe("staff mutations", () => {
  const base: Staff[] = [
    { id: "1", scheduleId: "A", name: "Alex", maxWeeklyHours: 40 },
    { id: "2", scheduleId: "B", name: "Sam", maxWeeklyHours: 24 },
  ]
  it("adds trimmed staff to the given schedule without mutating", () => {
    const next = addStaff(base, "A", { name: " Kim ", maxWeeklyHours: 20 }, "3")
    expect(next).toHaveLength(3)
    expect(next[2]).toEqual({
      id: "3",
      scheduleId: "A",
      name: "Kim",
      maxWeeklyHours: 20,
    })
    expect(base).toHaveLength(2)
  })
  it("updates only the target employee", () => {
    const next = updateStaff(base, "1", { name: "Alexa", maxWeeklyHours: 30 })
    expect(next[0]).toMatchObject({
      name: "Alexa",
      maxWeeklyHours: 30,
      scheduleId: "A",
    })
    expect(next[1]).toEqual(base[1])
  })
  it("removes an employee and cascades their assignments only", () => {
    const assignments: Assignment[] = [
      { id: "a", scheduleId: "A", staffId: "1", shiftId: "s", dayOfWeek: 0 },
      { id: "b", scheduleId: "B", staffId: "2", shiftId: "s", dayOfWeek: 0 },
    ]
    const result = removeStaff(base, assignments, "1")
    expect(result.staff.map((s) => s.id)).toEqual(["2"])
    expect(result.assignments.map((a) => a.id)).toEqual(["b"])
  })
})

describe("addStaffBatch", () => {
  it("appends all employees in order with unique ids and trimmed names", () => {
    let n = 0
    const base: Staff[] = [
      { id: "0", scheduleId: "A", name: "Old", maxWeeklyHours: 10 },
    ]
    const next = addStaffBatch(
      base,
      "A",
      [
        { name: " Kim ", maxWeeklyHours: 20 },
        { name: "Lee", maxWeeklyHours: 30 },
      ],
      () => `n${++n}`
    )
    expect(next.map((s) => [s.id, s.name, s.scheduleId])).toEqual([
      ["0", "Old", "A"],
      ["n1", "Kim", "A"],
      ["n2", "Lee", "A"],
    ])
    expect(base).toHaveLength(1)
  })
})

describe("validateStaffBatch", () => {
  it("skips blank-name rows and accepts the rest", () => {
    const r = validateStaffBatch([
      { name: "Kim", maxWeeklyHours: 20 },
      { name: "  ", maxWeeklyHours: 40 },
      { name: "Lee", maxWeeklyHours: 30 },
    ])
    expect(r.ok).toBe(true)
    expect(r.inputs.map((i) => i.name)).toEqual(["Kim", "Lee"])
  })
  it("reports errors by row index and rejects the whole batch", () => {
    const r = validateStaffBatch([
      { name: "Kim", maxWeeklyHours: 20 },
      { name: "Lee", maxWeeklyHours: 0 },
    ])
    expect(r.ok).toBe(false)
    expect(r.errors[0]).toBeUndefined()
    expect(r.errors[1]?.maxWeeklyHours).toBeDefined()
  })
  it("rejects an all-blank batch", () => {
    const r = validateStaffBatch([{ name: "", maxWeeklyHours: 40 }])
    expect(r.ok).toBe(false)
    expect(r.errors[0]?.name).toBeDefined()
  })
})

import { describe, expect, it } from "vitest"

import {
  addShift,
  findOverlapConflicts,
  getShiftUsage,
  removeShift,
  sortShifts,
  updateShift,
  validateShiftInput,
  validateShiftUpdate,
} from "./shift"
import type { Assignment, Shift } from "./types"

const shift = (id: string, startTime: string, endTime: string, scheduleId = "A"): Shift => ({
  id,
  scheduleId,
  startTime,
  endTime,
})
const asg = (id: string, staffId: string, shiftId: string, dayOfWeek: 0 | 1 = 0): Assignment => ({
  id,
  scheduleId: "A",
  staffId,
  shiftId,
  dayOfWeek,
})

const morning = shift("m", "07:00", "15:00")
const evening = shift("e", "15:00", "23:00")

describe("validateShiftInput", () => {
  it("accepts valid times, including ones overlapping other templates", () => {
    expect(validateShiftInput({ startTime: "11:00", endTime: "19:00" }, [morning, evening]).ok).toBe(true)
  })
  it("rejects missing or malformed times", () => {
    const r = validateShiftInput({ startTime: "", endTime: "9:00" }, [])
    expect(r.errors.startTime).toBeDefined()
    expect(r.errors.endTime).toBeDefined()
  })
  it("rejects end equal to start", () => {
    expect(validateShiftInput({ startTime: "10:00", endTime: "10:00" }, []).errors.endTime).toBeDefined()
  })
  it("rejects overnight shifts with an explanatory message", () => {
    const r = validateShiftInput({ startTime: "22:00", endTime: "06:00" }, [])
    expect(r.ok).toBe(false)
    expect(r.errors.endTime).toMatch(/overnight/i)
  })
  it("rejects exact duplicates but not the shift being edited", () => {
    expect(validateShiftInput({ startTime: "07:00", endTime: "15:00" }, [morning]).errors.form).toBeDefined()
    expect(validateShiftInput({ startTime: "07:00", endTime: "15:00" }, [morning], "m").ok).toBe(true)
  })
})

describe("shift mutations", () => {
  it("adds, updates and sorts without mutating", () => {
    const base = [evening, morning]
    const added = addShift(base, "A", { startTime: "11:00", endTime: "19:00" }, "x")
    expect(base).toHaveLength(2)
    expect(sortShifts(added).map((s) => s.id)).toEqual(["m", "x", "e"])
    expect(updateShift(added, "x", { startTime: "12:00", endTime: "20:00" })[2]).toMatchObject({
      id: "x",
      startTime: "12:00",
      endTime: "20:00",
      scheduleId: "A",
    })
  })
  it("removes a shift and cascades only its assignments", () => {
    const assignments = [asg("1", "s1", "m"), asg("2", "s2", "m"), asg("3", "s1", "e")]
    expect(getShiftUsage(assignments, "m")).toBe(2)
    const r = removeShift([morning, evening], assignments, "m")
    expect(r.shifts.map((s) => s.id)).toEqual(["e"])
    expect(r.assignments.map((a) => a.id)).toEqual(["3"])
  })
})

describe("findOverlapConflicts", () => {
  it("allows touching shifts and different employees sharing a shift", () => {
    const assignments = [asg("1", "s1", "m"), asg("2", "s1", "e"), asg("3", "s2", "m")]
    expect(findOverlapConflicts([morning, evening], assignments)).toEqual([])
  })
  it("detects overlap per employee per day only", () => {
    const mid = shift("mid", "12:00", "20:00")
    const same = [asg("1", "s1", "m"), asg("2", "s1", "mid")]
    expect(findOverlapConflicts([morning, mid], same)).toHaveLength(1)
    const otherDay = [asg("1", "s1", "m", 0), asg("2", "s1", "mid", 1)]
    expect(findOverlapConflicts([morning, mid], otherDay)).toEqual([])
  })
})

describe("validateShiftUpdate", () => {
  const shifts = [morning, evening]
  const assignments = [asg("1", "s1", "m"), asg("2", "s1", "e")]

  it("blocks an edit that makes an employee's assignments overlap", () => {
    const r = validateShiftUpdate(shifts, assignments, "m", { startTime: "07:00", endTime: "16:00" })
    expect(r.ok).toBe(false)
    expect(r.conflicts).toEqual([{ staffId: "s1", dayOfWeek: 0, shiftIds: ["m", "e"] }])
  })
  it("allows an edit with no resulting conflict", () => {
    expect(validateShiftUpdate(shifts, assignments, "m", { startTime: "06:00", endTime: "15:00" }).ok).toBe(true)
  })
  it("allows overlap when no employee holds both shifts", () => {
    const r = validateShiftUpdate(shifts, [asg("1", "s1", "m"), asg("2", "s2", "e")], "m", {
      startTime: "07:00",
      endTime: "16:00",
    })
    expect(r.ok).toBe(true)
  })
  it("still reports basic validation errors", () => {
    expect(validateShiftUpdate(shifts, assignments, "m", { startTime: "15:00", endTime: "07:00" }).ok).toBe(false)
  })
})

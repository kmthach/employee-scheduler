import { describe, expect, it } from "vitest"

import {
  addAssignment,
  checkAssignment,
  describeBlock,
  getOverMaxStaff,
  removeAssignment,
  replaceAssignments,
  updateAssignment,
} from "./assignment"
import type { Assignment, Shift, Staff } from "./types"

const staff: Staff[] = [
  { id: "alex", scheduleId: "A", name: "Alex", maxWeeklyHours: 40 },
  { id: "sam", scheduleId: "A", name: "Sam", maxWeeklyHours: 8 },
  { id: "other", scheduleId: "B", name: "Other", maxWeeklyHours: 40 },
]
const shifts: Shift[] = [
  { id: "am", scheduleId: "A", startTime: "07:00", endTime: "15:00" },
  { id: "pm", scheduleId: "A", startTime: "15:00", endTime: "23:00" },
  { id: "mid", scheduleId: "A", startTime: "12:00", endTime: "20:00" },
]
const asg = (
  id: string,
  staffId: string,
  shiftId: string,
  dayOfWeek: 0 | 1 = 0
): Assignment => ({
  id,
  scheduleId: "A",
  staffId,
  shiftId,
  dayOfWeek,
})

const data = (assignments: Assignment[]) => ({ staff, shifts, assignments })

describe("checkAssignment", () => {
  it("allows a first assignment, other days, touching shifts and shared shifts", () => {
    const existing = [asg("1", "alex", "am")]
    expect(
      checkAssignment(data([]), {
        staffId: "alex",
        shiftId: "am",
        dayOfWeek: 0,
      }).ok
    ).toBe(true)
    expect(
      checkAssignment(data(existing), {
        staffId: "alex",
        shiftId: "am",
        dayOfWeek: 1,
      }).ok
    ).toBe(true)
    expect(
      checkAssignment(data(existing), {
        staffId: "alex",
        shiftId: "pm",
        dayOfWeek: 0,
      }).ok
    ).toBe(true)
    expect(
      checkAssignment(data(existing), {
        staffId: "sam",
        shiftId: "am",
        dayOfWeek: 0,
      }).ok
    ).toBe(true)
  })

  it("blocks the identical shift twice on one day", () => {
    const r = checkAssignment(data([asg("1", "alex", "am")]), {
      staffId: "alex",
      shiftId: "am",
      dayOfWeek: 0,
    })
    expect(r).toEqual({ ok: false, reason: "duplicate", conflictShiftId: "am" })
    expect(describeBlock(r, shifts)).toBe("Already assigned")
  })

  it("allowOverlap skips the overlap check but still blocks the identical shift", () => {
    const existing = data([asg("1", "alex", "am")])
    expect(
      checkAssignment(
        existing,
        { staffId: "alex", shiftId: "mid", dayOfWeek: 0 },
        undefined,
        {
          allowOverlap: true,
        }
      ).ok
    ).toBe(true)
    expect(
      checkAssignment(
        existing,
        { staffId: "alex", shiftId: "am", dayOfWeek: 0 },
        undefined,
        {
          allowOverlap: true,
        }
      )
    ).toMatchObject({ ok: false, reason: "duplicate" })
  })

  it("blocks overlapping shifts and explains which one", () => {
    const r = checkAssignment(data([asg("1", "alex", "am")]), {
      staffId: "alex",
      shiftId: "mid",
      dayOfWeek: 0,
    })
    expect(r).toEqual({ ok: false, reason: "overlap", conflictShiftId: "am" })
    expect(describeBlock(r, shifts)).toBe("Overlaps 07:00–15:00")
  })

  it("ignores the assignment being changed", () => {
    const existing = [asg("1", "alex", "am")]
    expect(
      checkAssignment(
        data(existing),
        { staffId: "alex", shiftId: "mid", dayOfWeek: 0 },
        "1"
      ).ok
    ).toBe(true)
  })

  it("rejects missing references and cross-schedule pairs", () => {
    expect(
      checkAssignment(data([]), {
        staffId: "nope",
        shiftId: "am",
        dayOfWeek: 0,
      })
    ).toMatchObject({ reason: "missing-staff" })
    expect(
      checkAssignment(data([]), {
        staffId: "alex",
        shiftId: "nope",
        dayOfWeek: 0,
      })
    ).toMatchObject({ reason: "missing-shift" })
    expect(
      checkAssignment(data([]), {
        staffId: "other",
        shiftId: "am",
        dayOfWeek: 0,
      })
    ).toMatchObject({ reason: "wrong-schedule" })
  })

  it("does not block exceeding max weekly hours", () => {
    const existing = [asg("1", "sam", "am"), asg("2", "sam", "am", 1)]
    expect(
      checkAssignment(data(existing), {
        staffId: "sam",
        shiftId: "pm",
        dayOfWeek: 0,
      }).ok
    ).toBe(true)
  })
})

describe("assignment mutators", () => {
  it("adds, updates and removes without mutating", () => {
    const base = [asg("1", "alex", "am")]
    const added = addAssignment(
      base,
      "A",
      { staffId: "sam", shiftId: "pm", dayOfWeek: 2 },
      "2"
    )
    expect(base).toHaveLength(1)
    expect(added[1]).toEqual({
      id: "2",
      scheduleId: "A",
      staffId: "sam",
      shiftId: "pm",
      dayOfWeek: 2,
    })
    expect(updateAssignment(added, "1", { shiftId: "pm" })[0].shiftId).toBe(
      "pm"
    )
    expect(removeAssignment(added, "1").map((a) => a.id)).toEqual(["2"])
  })
})

describe("getOverMaxStaff", () => {
  it("lists only employees strictly over their max, and updates after changes", () => {
    const atMax = [asg("1", "sam", "am")] // 8h of 8h
    expect(getOverMaxStaff(staff, atMax, shifts)).toEqual([])
    const over = [...atMax, asg("2", "sam", "am", 1)] // 16h of 8h
    const result = getOverMaxStaff(staff, over, shifts)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ assigned: 16 })
    expect(result[0].staff.id).toBe("sam")
    expect(getOverMaxStaff(staff, removeAssignment(over, "2"), shifts)).toEqual(
      []
    )
  })
})

describe("replaceAssignments", () => {
  const old = (id: string, scheduleId: string): Assignment => ({
    id,
    scheduleId,
    staffId: "x",
    shiftId: "y",
    dayOfWeek: 0,
  })

  it("replaces only the given schedule's assignments", () => {
    let n = 0
    const result = replaceAssignments(
      [old("1", "w1"), old("2", "w2"), old("3", "w1")],
      "w1",
      [
        { staffId: "a", shiftId: "s", dayOfWeek: 1 },
        { staffId: "b", shiftId: "s", dayOfWeek: 2 },
      ],
      () => `new${n++}`
    )
    expect(result.filter((a) => a.scheduleId === "w2")).toEqual([
      old("2", "w2"),
    ])
    const w1 = result.filter((a) => a.scheduleId === "w1")
    expect(w1.map((a) => a.id)).toEqual(["new0", "new1"])
    expect(w1.map((a) => a.staffId)).toEqual(["a", "b"])
  })

  it("clears the schedule when there are no candidates", () => {
    expect(replaceAssignments([old("1", "w1")], "w1", [], () => "n")).toEqual(
      []
    )
  })
})

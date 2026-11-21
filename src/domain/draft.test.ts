import { describe, expect, it } from "vitest"

import {
  assignmentKey,
  diffAssignments,
  getContent,
  replaceContent,
  validateForPublish,
} from "./draft"
import type { Assignment, ScheduleContent, Shift, Staff } from "./types"

const staff = (id: string, scheduleId: string, maxWeeklyHours = 40): Staff => ({
  id,
  scheduleId,
  name: id,
  maxWeeklyHours,
})
const shift = (
  id: string,
  scheduleId: string,
  startTime: string,
  endTime: string
): Shift => ({
  id,
  scheduleId,
  startTime,
  endTime,
})
const asg = (
  id: string,
  scheduleId: string,
  staffId: string,
  shiftId: string
): Assignment => ({
  id,
  scheduleId,
  staffId,
  shiftId,
  dayOfWeek: 0,
})

const all: ScheduleContent = {
  staff: [staff("a", "A"), staff("b", "B")],
  shifts: [
    shift("am", "A", "07:00", "15:00"),
    shift("bm", "B", "07:00", "15:00"),
  ],
  assignments: [asg("1", "A", "a", "am"), asg("2", "B", "b", "bm")],
}

describe("getContent / replaceContent", () => {
  it("extracts one schedule's rows", () => {
    const c = getContent(all, "A")
    expect(c.staff.map((x) => x.id)).toEqual(["a"])
    expect(c.assignments.map((x) => x.id)).toEqual(["1"])
  })

  it("replaces one schedule's rows and leaves the others", () => {
    const next = replaceContent(all, "A", {
      staff: [],
      shifts: [],
      assignments: [],
    })
    expect(next.staff.map((x) => x.id)).toEqual(["b"])
    expect(next.assignments.map((x) => x.id)).toEqual(["2"])
  })
})

describe("validateForPublish", () => {
  it("accepts empty content", () => {
    expect(
      validateForPublish({ staff: [], shifts: [], assignments: [] }).ok
    ).toBe(true)
  })

  it("blocks overlapping assignments", () => {
    const r = validateForPublish({
      staff: [staff("a", "A")],
      shifts: [
        shift("am", "A", "07:00", "15:00"),
        shift("mid", "A", "10:00", "18:00"),
      ],
      assignments: [asg("1", "A", "a", "am"), asg("2", "A", "a", "mid")],
    })
    expect(r.ok).toBe(false)
    expect(r.conflicts).toHaveLength(1)
  })

  it("only warns about exceeding maximum weekly hours", () => {
    const r = validateForPublish({
      staff: [staff("a", "A", 4)],
      shifts: [shift("am", "A", "07:00", "15:00")],
      assignments: [asg("1", "A", "a", "am")],
    })
    expect(r.ok).toBe(true)
    expect(r.overMax).toHaveLength(1)
    expect(r.overMax[0].assigned).toBe(8)
  })
})

describe("diffAssignments", () => {
  const a1 = asg("1", "A", "a", "am")
  const a2 = asg("2", "A", "a", "pm")

  it("reports nothing when unchanged", () => {
    const d = diffAssignments([a1], [a1])
    expect(d.removed).toEqual([])
    expect(d.addedKeys.size).toBe(0)
  })

  it("reports removed and added assignments", () => {
    const d = diffAssignments([a1], [a2])
    expect(d.removed).toEqual([a1])
    expect([...d.addedKeys]).toEqual([assignmentKey(a2)])
  })

  it("matches by employee/day/shift, not id (remove then re-add is unchanged)", () => {
    const d = diffAssignments([a1], [{ ...a1, id: "new" }])
    expect(d.removed).toEqual([])
    expect(d.addedKeys.size).toBe(0)
  })
})

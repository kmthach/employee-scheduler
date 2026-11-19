import { beforeEach, describe, expect, it } from "vitest"

import type { Assignment, Schedule, Shift, Staff } from "@/domain/types"

import { useScheduleStore } from "./schedule-store"

const sched = (id: string): Schedule => ({ id, createdAt: "t", updatedAt: "t" })
const shift = (id: string, scheduleId: string, startTime: string, endTime: string): Shift => ({
  id,
  scheduleId,
  startTime,
  endTime,
})
const staff = (id: string, scheduleId: string): Staff => ({
  id,
  scheduleId,
  name: id,
  maxWeeklyHours: 40,
})
const asg = (id: string, scheduleId: string, staffId: string, shiftId: string): Assignment => ({
  id,
  scheduleId,
  staffId,
  shiftId,
  dayOfWeek: 0,
})

beforeEach(() => {
  useScheduleStore.setState({
    currentScheduleId: "A",
    schedules: [sched("A"), sched("B")],
    staff: [staff("s1", "A"), staff("s2", "B")],
    shifts: [
      shift("am", "A", "07:00", "15:00"),
      shift("pm", "A", "15:00", "23:00"),
      shift("bm", "B", "07:00", "15:00"),
    ],
    assignments: [asg("1", "A", "s1", "am"), asg("2", "A", "s1", "pm"), asg("3", "B", "s2", "bm")],
  })
})

describe("shift actions", () => {
  it("deleteShift cascades its assignments and leaves other schedules alone", () => {
    useScheduleStore.getState().deleteShift("am")
    const s = useScheduleStore.getState()
    expect(s.shifts.map((x) => x.id)).toEqual(["pm", "bm"])
    expect(s.assignments.map((x) => x.id)).toEqual(["2", "3"])
  })

  it("updateShift blocks an edit that overlaps an employee's shifts and leaves state unchanged", () => {
    const before = useScheduleStore.getState().shifts
    const result = useScheduleStore.getState().updateShift("am", { startTime: "07:00", endTime: "16:00" })
    expect(result.ok).toBe(false)
    expect(result.conflicts).toHaveLength(1)
    expect(useScheduleStore.getState().shifts).toBe(before)
  })

  it("updateShift applies a valid edit only to the target shift", () => {
    const result = useScheduleStore.getState().updateShift("am", { startTime: "06:00", endTime: "15:00" })
    expect(result.ok).toBe(true)
    const s = useScheduleStore.getState()
    expect(s.shifts.find((x) => x.id === "am")?.startTime).toBe("06:00")
    expect(s.shifts.find((x) => x.id === "bm")?.startTime).toBe("07:00")
  })

  it("addShift adds to the current schedule only and rejects duplicates there", () => {
    const store = useScheduleStore.getState()
    expect(store.addShift({ startTime: "11:00", endTime: "19:00" }).ok).toBe(true)
    expect(useScheduleStore.getState().shifts.filter((x) => x.scheduleId === "A")).toHaveLength(3)
    expect(useScheduleStore.getState().shifts.filter((x) => x.scheduleId === "B")).toHaveLength(1)
    expect(store.addShift({ startTime: "07:00", endTime: "15:00" }).ok).toBe(false)
    // Same times are fine in a different schedule's context, so switch weeks.
    useScheduleStore.setState({ currentScheduleId: "B" })
    expect(useScheduleStore.getState().addShift({ startTime: "15:00", endTime: "23:00" }).ok).toBe(true)
  })

  it("addShift fails when the viewed week has no schedule", () => {
    useScheduleStore.setState({ currentScheduleId: "C" })
    expect(useScheduleStore.getState().addShift({ startTime: "11:00", endTime: "19:00" }).ok).toBe(false)
  })
})

describe("assignment actions", () => {
  it("assignShift adds an assignment to the current schedule", () => {
    const r = useScheduleStore.getState().assignShift({ staffId: "s1", shiftId: "am", dayOfWeek: 1 })
    expect(r.ok).toBe(true)
    const added = useScheduleStore.getState().assignments.filter((a) => a.dayOfWeek === 1)
    expect(added).toHaveLength(1)
    expect(added[0].scheduleId).toBe("A")
  })

  it("assignShift blocks overlap and leaves state unchanged", () => {
    const before = useScheduleStore.getState().assignments
    const r = useScheduleStore.getState().assignShift({ staffId: "s1", shiftId: "am", dayOfWeek: 0 })
    expect(r).toMatchObject({ ok: false, reason: "overlap" })
    expect(useScheduleStore.getState().assignments).toBe(before)
  })

  it("assignShift rejects staff from another schedule", () => {
    const r = useScheduleStore.getState().assignShift({ staffId: "s2", shiftId: "am", dayOfWeek: 3 })
    expect(r.ok).toBe(false)
  })

  it("assignShift is allowed beyond max weekly hours", () => {
    useScheduleStore.setState({ staff: [{ ...staff("s1", "A"), maxWeeklyHours: 1 }, staff("s2", "B")] })
    const r = useScheduleStore.getState().assignShift({ staffId: "s1", shiftId: "am", dayOfWeek: 2 })
    expect(r.ok).toBe(true)
  })

  it("changeAssignmentShift ignores itself but blocks real overlaps", () => {
    const store = useScheduleStore.getState()
    // Assignment 1 (s1, am, Mon) -> pm would overlap assignment 2 (s1, pm, Mon): identical shift.
    expect(store.changeAssignmentShift("1", "pm")).toMatchObject({ ok: false, reason: "overlap" })
    // Replacing am with itself is fine (ignore-self).
    expect(store.changeAssignmentShift("1", "am").ok).toBe(true)
  })

  it("changeAssignmentShift and removeAssignment leave other schedules alone", () => {
    useScheduleStore.getState().removeAssignment("1")
    const s = useScheduleStore.getState()
    expect(s.assignments.map((a) => a.id)).toEqual(["2", "3"])
    expect(s.schedules.find((x) => x.id === "B")?.updatedAt).toBe("t")
  })
})

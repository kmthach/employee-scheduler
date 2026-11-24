import { beforeEach, describe, expect, it } from "vitest"

import type { Assignment, Schedule, Shift, Staff } from "@/domain/types"

import { getTransactionsPerStaffHour, useScheduleStore } from "./schedule-store"

const sched = (id: string, status: Schedule["status"] = "draft"): Schedule => ({
  id,
  status,
  createdAt: "t",
  updatedAt: "t",
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
const staff = (id: string, scheduleId: string): Staff => ({
  id,
  scheduleId,
  name: id,
  maxWeeklyHours: 40,
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
    assignments: [
      asg("1", "A", "s1", "am"),
      asg("2", "A", "s1", "pm"),
      asg("3", "B", "s2", "bm"),
    ],
    publishedSnapshots: {},
    autoScheduleUndo: null,
    transactionsPerStaffHour: {},
    transactions: [],
    transactionReports: {},
  })
})

describe("shift actions", () => {
  it("deleteShift cascades its assignments and leaves other schedules alone", () => {
    useScheduleStore.getState().deleteShift("am")
    const s = useScheduleStore.getState()
    expect(s.shifts.map((x) => x.id)).toEqual(["pm", "bm"])
    expect(s.assignments.map((x) => x.id)).toEqual(["2", "3"])
  })

  it("updateShift saves an edit that overlaps an employee's shifts and reports the conflict", () => {
    const result = useScheduleStore
      .getState()
      .updateShift("am", { startTime: "07:00", endTime: "16:00" })
    expect(result.ok).toBe(true)
    expect(result.conflicts).toHaveLength(1)
    expect(
      useScheduleStore.getState().shifts.find((x) => x.id === "am")?.endTime
    ).toBe("16:00")
  })

  it("updateShift applies a valid edit only to the target shift", () => {
    const result = useScheduleStore
      .getState()
      .updateShift("am", { startTime: "06:00", endTime: "15:00" })
    expect(result.ok).toBe(true)
    const s = useScheduleStore.getState()
    expect(s.shifts.find((x) => x.id === "am")?.startTime).toBe("06:00")
    expect(s.shifts.find((x) => x.id === "bm")?.startTime).toBe("07:00")
  })

  it("addShift adds to the current schedule only and rejects duplicates there", () => {
    const store = useScheduleStore.getState()
    expect(store.addShift({ startTime: "11:00", endTime: "19:00" }).ok).toBe(
      true
    )
    expect(
      useScheduleStore.getState().shifts.filter((x) => x.scheduleId === "A")
    ).toHaveLength(3)
    expect(
      useScheduleStore.getState().shifts.filter((x) => x.scheduleId === "B")
    ).toHaveLength(1)
    expect(store.addShift({ startTime: "07:00", endTime: "15:00" }).ok).toBe(
      false
    )
    // Same times are fine in a different schedule's context, so switch weeks.
    useScheduleStore.setState({ currentScheduleId: "B" })
    expect(
      useScheduleStore
        .getState()
        .addShift({ startTime: "15:00", endTime: "23:00" }).ok
    ).toBe(true)
  })

  it("addShift fails when the viewed week has no schedule", () => {
    useScheduleStore.setState({ currentScheduleId: "C" })
    expect(
      useScheduleStore
        .getState()
        .addShift({ startTime: "11:00", endTime: "19:00" }).ok
    ).toBe(false)
  })
})

describe("assignment actions", () => {
  it("assignShift adds an assignment to the current schedule", () => {
    const r = useScheduleStore
      .getState()
      .assignShift({ staffId: "s1", shiftId: "am", dayOfWeek: 1 })
    expect(r.ok).toBe(true)
    const added = useScheduleStore
      .getState()
      .assignments.filter((a) => a.dayOfWeek === 1)
    expect(added).toHaveLength(1)
    expect(added[0].scheduleId).toBe("A")
  })

  it("assignShift blocks overlap and leaves state unchanged", () => {
    const before = useScheduleStore.getState().assignments
    const r = useScheduleStore
      .getState()
      .assignShift({ staffId: "s1", shiftId: "am", dayOfWeek: 0 })
    expect(r).toMatchObject({ ok: false, reason: "duplicate" })
    expect(useScheduleStore.getState().assignments).toBe(before)
  })

  it("assignShift rejects staff from another schedule", () => {
    const r = useScheduleStore
      .getState()
      .assignShift({ staffId: "s2", shiftId: "am", dayOfWeek: 3 })
    expect(r.ok).toBe(false)
  })

  it("assignShift blocks going over max weekly hours and leaves state unchanged", () => {
    // s1 already has am + pm (16 h); a maximum of 16 h leaves no room for another shift.
    useScheduleStore.setState({
      staff: [{ ...staff("s1", "A"), maxWeeklyHours: 16 }, staff("s2", "B")],
    })
    const before = useScheduleStore.getState().assignments
    const r = useScheduleStore
      .getState()
      .assignShift({ staffId: "s1", shiftId: "am", dayOfWeek: 2 })
    expect(r).toMatchObject({ ok: false, reason: "over-max" })
    expect(useScheduleStore.getState().assignments).toBe(before)
  })

  it("restoreAssignment is also blocked when it would exceed the maximum", () => {
    useScheduleStore.setState({
      staff: [{ ...staff("s1", "A"), maxWeeklyHours: 16 }, staff("s2", "B")],
    })
    const r = useScheduleStore
      .getState()
      .restoreAssignment({ staffId: "s1", shiftId: "am", dayOfWeek: 3 })
    expect(r).toMatchObject({ ok: false, reason: "over-max" })
  })

  it("changeAssignmentShift only counts the new shift, not the one it replaces", () => {
    useScheduleStore.setState({
      staff: [{ ...staff("s1", "A"), maxWeeklyHours: 8 }, staff("s2", "B")],
      assignments: [asg("1", "A", "s1", "am"), asg("3", "B", "s2", "bm")],
    })
    expect(
      useScheduleStore.getState().changeAssignmentShift("1", "pm").ok
    ).toBe(true)
  })

  it("changeAssignmentShift ignores itself but blocks real overlaps", () => {
    const store = useScheduleStore.getState()
    // Assignment 1 (s1, am, Mon) -> pm would overlap assignment 2 (s1, pm, Mon): identical shift.
    expect(store.changeAssignmentShift("1", "pm")).toMatchObject({
      ok: false,
      reason: "duplicate",
    })
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

describe("draft and published status", () => {
  const publishedA = () => {
    useScheduleStore.setState({
      schedules: [sched("A", "published"), sched("B")],
    })
  }
  const status = (id = "A") =>
    useScheduleStore.getState().schedules.find((x) => x.id === id)?.status

  it("edits a never-published schedule in place without a snapshot", () => {
    useScheduleStore
      .getState()
      .assignShift({ staffId: "s1", shiftId: "am", dayOfWeek: 1 })
    expect(status()).toBe("draft")
    expect(useScheduleStore.getState().publishedSnapshots).toEqual({})
  })

  it("publishes a valid draft", () => {
    const r = useScheduleStore.getState().publishSchedule()
    expect(r.ok).toBe(true)
    expect(status()).toBe("published")
  })

  it("first assignment change on a published schedule starts a draft and keeps the published rows", () => {
    publishedA()
    useScheduleStore.getState().removeAssignment("1")
    const s = useScheduleStore.getState()
    expect(status()).toBe("draft")
    expect(s.assignments.map((a) => a.id)).toEqual(["2", "3"])
    expect(s.publishedSnapshots.A.assignments.map((a) => a.id)).toEqual([
      "1",
      "2",
    ])
    // Later edits reuse the same snapshot.
    useScheduleStore.getState().removeAssignment("2")
    expect(
      useScheduleStore.getState().publishedSnapshots.A.assignments
    ).toHaveLength(2)
  })

  it("publishing clears the snapshot and keeps the draft's content", () => {
    publishedA()
    useScheduleStore.getState().removeAssignment("1")
    expect(useScheduleStore.getState().publishSchedule().ok).toBe(true)
    const s = useScheduleStore.getState()
    expect(status()).toBe("published")
    expect(s.publishedSnapshots.A).toBeUndefined()
    expect(s.assignments.map((a) => a.id)).toEqual(["2", "3"])
  })

  it("discardDraft restores the published content and leaves other schedules alone", () => {
    publishedA()
    useScheduleStore.getState().removeAssignment("1")
    useScheduleStore
      .getState()
      .assignShift({ staffId: "s1", shiftId: "am", dayOfWeek: 4 })
    useScheduleStore.getState().discardDraft()
    const s = useScheduleStore.getState()
    expect(status()).toBe("published")
    expect(s.publishedSnapshots.A).toBeUndefined()
    expect(s.assignments.map((a) => a.id).sort()).toEqual(["1", "2", "3"])
  })

  it("staff edits count as a change", () => {
    publishedA()
    useScheduleStore
      .getState()
      .updateStaff("s1", { name: "New", maxWeeklyHours: 20 })
    expect(status()).toBe("draft")
    expect(useScheduleStore.getState().publishedSnapshots.A.staff[0].name).toBe(
      "s1"
    )
  })

  it("adding, editing and deleting any shift template starts a draft", () => {
    const { shifts, assignments } = useScheduleStore.getState()
    for (const change of [
      () =>
        useScheduleStore
          .getState()
          .addShift({ startTime: "11:00", endTime: "19:00" }),
      () =>
        useScheduleStore
          .getState()
          .updateShift("am", { startTime: "06:00", endTime: "15:00" }),
      () => useScheduleStore.getState().deleteShift("pm"),
    ]) {
      useScheduleStore.setState({
        schedules: [sched("A", "published"), sched("B")],
        shifts,
        assignments,
        publishedSnapshots: {},
      })
      change()
      expect(status()).toBe("draft")
      expect(
        useScheduleStore.getState().publishedSnapshots.A.shifts.map((x) => x.id)
      ).toEqual(["am", "pm"])
    }
  })

  it("discardDraft restores edited, added and deleted shift templates", () => {
    publishedA()
    const store = useScheduleStore.getState()
    store.updateShift("am", { startTime: "06:00", endTime: "15:00" })
    store.addShift({ startTime: "11:00", endTime: "19:00" })
    store.deleteShift("pm")
    useScheduleStore.getState().discardDraft()
    const s = useScheduleStore.getState()
    expect(status()).toBe("published")
    const a = s.shifts.filter((x) => x.scheduleId === "A")
    expect(a.map((x) => `${x.id} ${x.startTime}-${x.endTime}`).sort()).toEqual([
      "am 07:00-15:00",
      "pm 15:00-23:00",
    ])
    expect(s.assignments.map((x) => x.id).sort()).toEqual(["1", "2", "3"])
  })

  it("restoreAssignment brings back a removed assignment even if it now overlaps", () => {
    publishedA()
    useScheduleStore.getState().removeAssignment("1") // s1 am, Mon
    useScheduleStore
      .getState()
      .updateShift("pm", { startTime: "14:00", endTime: "23:00" })
    const r = useScheduleStore
      .getState()
      .restoreAssignment({ staffId: "s1", shiftId: "am", dayOfWeek: 0 })
    expect(r.ok).toBe(true)
    expect(
      useScheduleStore.getState().assignments.filter((a) => a.staffId === "s1")
    ).toHaveLength(2)
    expect(useScheduleStore.getState().publishSchedule().ok).toBe(false)
  })

  it("an overlapping template edit blocks publishing until it is fixed", () => {
    publishedA()
    useScheduleStore
      .getState()
      .updateShift("am", { startTime: "07:00", endTime: "16:00" })
    expect(useScheduleStore.getState().publishSchedule().ok).toBe(false)
    expect(status()).toBe("draft")
    useScheduleStore
      .getState()
      .updateShift("am", { startTime: "07:00", endTime: "15:00" })
    expect(useScheduleStore.getState().publishSchedule().ok).toBe(true)
    expect(status()).toBe("published")
  })

  it("publish is blocked while assignments overlap", () => {
    useScheduleStore.setState({
      shifts: [
        shift("am", "A", "07:00", "15:00"),
        shift("mid", "A", "10:00", "18:00"),
      ],
      assignments: [asg("1", "A", "s1", "am"), asg("2", "A", "s1", "mid")],
    })
    const r = useScheduleStore.getState().publishSchedule()
    expect(r.ok).toBe(false)
    expect(r.conflicts).toHaveLength(1)
    expect(status()).toBe("draft")
  })

  it("publish is blocked while an employee exceeds max weekly hours", () => {
    // e.g. after lowering the maximum or lengthening a shift template.
    useScheduleStore.setState({
      staff: [{ ...staff("s1", "A"), maxWeeklyHours: 1 }, staff("s2", "B")],
    })
    const r = useScheduleStore.getState().publishSchedule()
    expect(r.ok).toBe(false)
    expect(r.overMax).toHaveLength(1)
    expect(
      useScheduleStore.getState().schedules.find((x) => x.id === "A")?.status
    ).toBe("draft")
  })
})

describe("transactions", () => {
  const rec = (id: string, scheduleId: string, count: number) => ({
    id,
    scheduleId,
    dayOfWeek: 0 as const,
    hour: 9,
    transactionCount: count,
  })
  const report = { fileName: null, savedAt: "t" }

  it("replaces the dataset for the current schedule only", () => {
    const { saveTransactions } = useScheduleStore.getState()
    saveTransactions([rec("1", "A", 5), rec("2", "A", 6)], report)
    useScheduleStore.setState({ currentScheduleId: "B" })
    useScheduleStore.getState().saveTransactions([rec("3", "B", 9)], report)
    useScheduleStore.setState({ currentScheduleId: "A" })
    useScheduleStore.getState().saveTransactions([rec("4", "A", 7)], report)
    const ids = useScheduleStore
      .getState()
      .transactions.map((t) => t.id)
      .sort()
    expect(ids).toEqual(["3", "4"])
  })

  it("ignores saves for a week with no schedule", () => {
    useScheduleStore.setState({ currentScheduleId: "Z" })
    useScheduleStore.getState().saveTransactions([rec("1", "Z", 1)], report)
    expect(useScheduleStore.getState().transactions).toEqual([])
  })

  it("does not turn a published schedule into a draft", () => {
    useScheduleStore.setState({
      schedules: [sched("A", "published"), sched("B")],
    })
    useScheduleStore.getState().saveTransactions([rec("1", "A", 1)], report)
    expect(useScheduleStore.getState().schedules[0].status).toBe("published")
    expect(useScheduleStore.getState().publishedSnapshots).toEqual({})
  })

  it("clears only the current schedule", () => {
    useScheduleStore.setState({
      transactions: [rec("1", "A", 1), rec("2", "B", 2)],
      transactionReports: { A: report, B: report },
    })
    useScheduleStore.getState().clearTransactions()
    const s = useScheduleStore.getState()
    expect(s.transactions.map((t) => t.id)).toEqual(["2"])
    expect(Object.keys(s.transactionReports)).toEqual(["B"])
  })
})

describe("auto-schedule apply and undo", () => {
  const generated = [
    { staffId: "s1", shiftId: "pm", dayOfWeek: 2 as const },
    { staffId: "s1", shiftId: "am", dayOfWeek: 3 as const },
  ]
  const inA = () =>
    useScheduleStore.getState().assignments.filter((a) => a.scheduleId === "A")

  it("replaces only the viewed week's assignments", () => {
    useScheduleStore.getState().applyGeneratedAssignments(generated)
    expect(inA().map((a) => [a.shiftId, a.dayOfWeek])).toEqual([
      ["pm", 2],
      ["am", 3],
    ])
    expect(
      useScheduleStore
        .getState()
        .assignments.filter((a) => a.scheduleId === "B")
    ).toHaveLength(1)
  })

  it("undo restores the previous assignments exactly", () => {
    const before = inA()
    useScheduleStore.getState().applyGeneratedAssignments(generated)
    useScheduleStore.getState().undoAutoSchedule()
    expect(inA()).toEqual(before)
    expect(useScheduleStore.getState().autoScheduleUndo).toBeNull()
  })

  it("a manual edit clears undo so later edits are never overwritten", () => {
    useScheduleStore.getState().applyGeneratedAssignments(generated)
    const first = inA()[0]
    useScheduleStore.getState().removeAssignment(first.id)
    expect(useScheduleStore.getState().autoScheduleUndo).toBeNull()
    useScheduleStore.getState().undoAutoSchedule()
    expect(inA()).toHaveLength(1)
  })

  it("turns a published week into a draft and keeps the published version", () => {
    useScheduleStore.setState({
      schedules: [sched("A", "published"), sched("B")],
    })
    useScheduleStore.getState().applyGeneratedAssignments(generated)
    const state = useScheduleStore.getState()
    expect(state.schedules.find((x) => x.id === "A")?.status).toBe("draft")
    expect(state.publishedSnapshots.A.assignments.map((a) => a.id)).toEqual([
      "1",
      "2",
    ])
    state.discardDraft()
    expect(inA().map((a) => a.id)).toEqual(["1", "2"])
  })

  it("records the published assignments it replaced, cleared on discard", () => {
    useScheduleStore.setState({
      schedules: [sched("A", "published"), sched("B")],
    })
    useScheduleStore.getState().applyGeneratedAssignments(generated)
    const keys = useScheduleStore.getState().autoRemovedKeys.A
    expect(keys).toHaveLength(2)
    useScheduleStore.getState().discardDraft()
    expect(useScheduleStore.getState().autoRemovedKeys.A).toBeUndefined()
  })

  it("does nothing when the viewed week has no schedule", () => {
    useScheduleStore.setState({ currentScheduleId: "Z" })
    useScheduleStore.getState().applyGeneratedAssignments(generated)
    expect(useScheduleStore.getState().autoScheduleUndo).toBeNull()
  })
})

describe("transactions per staff hour setting", () => {
  it("defaults to 15 for a week without a saved value", () => {
    expect(getTransactionsPerStaffHour(useScheduleStore.getState(), "A")).toBe(
      15
    )
  })

  it("is saved per week and weeks stay independent", () => {
    useScheduleStore.getState().setTransactionsPerStaffHour("A", 20)
    const state = useScheduleStore.getState()
    expect(getTransactionsPerStaffHour(state, "A")).toBe(20)
    expect(getTransactionsPerStaffHour(state, "B")).toBe(15)
  })

  it("ignores invalid values", () => {
    const store = useScheduleStore.getState()
    for (const bad of [0, -3, 2.5, NaN, 1001])
      store.setTransactionsPerStaffHour("A", bad)
    expect(getTransactionsPerStaffHour(useScheduleStore.getState(), "A")).toBe(
      15
    )
  })

  it("never starts a draft or clears Undo", () => {
    useScheduleStore.setState({
      schedules: [sched("A", "published"), sched("B")],
      autoScheduleUndo: { scheduleId: "A", assignments: [] },
    })
    useScheduleStore.getState().setTransactionsPerStaffHour("A", 10)
    const state = useScheduleStore.getState()
    expect(state.schedules.find((x) => x.id === "A")?.status).toBe("published")
    expect(state.autoScheduleUndo).not.toBeNull()
  })
})

describe("deleteSchedule", () => {
  it("removes the viewed week with its rows, clears its undo, and keeps other weeks", () => {
    useScheduleStore.setState({
      autoScheduleUndo: { scheduleId: "A", assignments: [] },
    })
    useScheduleStore.getState().deleteSchedule()
    const s = useScheduleStore.getState()
    expect(s.schedules.map((x) => x.id)).toEqual(["B"])
    expect(s.staff.map((x) => x.id)).toEqual(["s2"])
    expect(s.shifts.map((x) => x.id)).toEqual(["bm"])
    expect(s.assignments.map((x) => x.id)).toEqual(["3"])
    expect(s.autoScheduleUndo).toBeNull()
  })

  it("keeps another week's undo and ignores a week that doesn't exist", () => {
    const undo = { scheduleId: "B", assignments: [] }
    useScheduleStore.setState({ autoScheduleUndo: undo })
    useScheduleStore.getState().deleteSchedule()
    expect(useScheduleStore.getState().autoScheduleUndo).toBe(undo)
    useScheduleStore.setState({ currentScheduleId: "Z" })
    useScheduleStore.getState().deleteSchedule()
    expect(useScheduleStore.getState().schedules).toHaveLength(1)
  })
})

import "fake-indexeddb/auto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import type { NewScheduleSetup } from "@/domain/schedule"
import { clearState, loadState } from "@/storage/persistence"

import { startPersistence } from "./persist"
import { useScheduleStore } from "./schedule-store"

const setup: NewScheduleSetup = {
  shifts: [
    { startTime: "07:00", endTime: "15:00" },
    { startTime: "15:00", endTime: "23:00" },
  ],
  staff: [
    { name: "Ann", maxWeeklyHours: 40 },
    { name: "Bo", maxWeeklyHours: 20 },
  ],
  transactions: [
    { dayOfWeek: 0, hour: 9, transactionCount: 30 },
    { dayOfWeek: 1, hour: 12, transactionCount: 45 },
  ],
}

const empty = {
  schedules: [],
  staff: [],
  shifts: [],
  assignments: [],
  publishedSnapshots: {},
  autoScheduleUndo: null,
  autoRemovedKeys: {},
  transactionsPerStaffHour: {},
  transactions: [],
  transactionReports: {},
  hydrated: false,
  persistenceError: null,
  currentScheduleId: "2026-08-10",
  todayScheduleId: "2026-08-10",
}

let stop: () => void
let flush: () => Promise<void>

beforeEach(async () => {
  await clearState()
  useScheduleStore.setState(empty)
  ;({ stop, flush } = startPersistence())
})
afterEach(() => stop())

/** Simulates a page reload: fresh in-memory state, then hydrate from IndexedDB. */
async function reload() {
  useScheduleStore.setState(empty)
  await useScheduleStore.getState().hydrate()
}

describe("persistence", () => {
  it("does not write before hydration, so saved data is never overwritten by the empty state", async () => {
    useScheduleStore.getState().createSchedule()
    await flush()
    expect(await loadState()).toEqual({ status: "empty" })
  })

  it("restores schedules, staff, shifts, transactions and drafts after a reload", async () => {
    await useScheduleStore.getState().hydrate()
    useScheduleStore.getState().createSchedule(setup)
    const s = useScheduleStore.getState()
    s.assignShift({
      staffId: s.staff[0].id,
      shiftId: s.shifts[0].id,
      dayOfWeek: 0,
    })
    s.setTransactionsPerStaffHour("2026-08-10", 12)
    s.publishSchedule()
    // Editing a published week starts a draft with a snapshot.
    const after = useScheduleStore.getState()
    after.removeAssignment(after.assignments[0].id)
    await flush()
    const before = useScheduleStore.getState()

    await reload()
    const restored = useScheduleStore.getState()
    expect(restored.hydrated).toBe(true)
    expect(restored.schedules).toEqual(before.schedules)
    expect(restored.staff).toEqual(before.staff)
    expect(restored.transactions).toEqual(before.transactions)
    expect(restored.publishedSnapshots).toEqual(before.publishedSnapshots)
    expect(Object.keys(restored.publishedSnapshots)).toEqual(["2026-08-10"])
    expect(restored.transactionsPerStaffHour).toEqual({ "2026-08-10": 12 })

    restored.discardDraft()
    expect(useScheduleStore.getState().assignments).toHaveLength(1)
  })

  it("debounces saves: nothing is written until the delay passes or flush is called", async () => {
    await useScheduleStore.getState().hydrate()
    useScheduleStore.getState().createSchedule(setup)
    useScheduleStore
      .getState()
      .addStaffMany([{ name: "Zed", maxWeeklyHours: 10 }])
    expect(await loadState()).toEqual({ status: "empty" })
    await flush()
    await reload()
    expect(useScheduleStore.getState().staff.map((x) => x.name)).toContain(
      "Zed"
    )
  })

  it("starts empty with an error flag when stored data is corrupt", async () => {
    const { setItem } = await import("@/storage/idb")
    await setItem("state", { version: 1, data: 5 })
    await useScheduleStore.getState().hydrate()
    const s = useScheduleStore.getState()
    expect(s.hydrated).toBe(true)
    expect(s.persistenceError).toBe("corrupt")
    expect(s.schedules).toEqual([])
  })

  it("manager workflow across several weeks survives a reload", async () => {
    await useScheduleStore.getState().hydrate()
    const st = () => useScheduleStore.getState()
    st().createSchedule(setup)
    st().applyGeneratedAssignments(
      st()
        .staff.slice(0, 2)
        .map((p, i) => ({
          staffId: p.id,
          shiftId: st().shifts[i].id,
          dayOfWeek: 1,
        }))
    )
    expect(st().publishSchedule().ok).toBe(true)
    st().goToNextWeek()
    st().copyPreviousSchedule()
    st().goToNextWeek()
    st().createSchedule()
    expect(st().schedules.map((x) => x.id)).toEqual([
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
    ])
    const snapshot = st()
    await flush()

    await reload()
    const r = st()
    expect(r.schedules).toEqual(snapshot.schedules)
    expect(r.assignments).toEqual(snapshot.assignments)
    expect(r.transactions).toEqual(snapshot.transactions)
    expect(r.schedules[0].status).toBe("published")
    expect(r.autoScheduleUndo).toBeNull()
  })

  it("a deleted schedule stays deleted after a reload", async () => {
    await useScheduleStore.getState().hydrate()
    useScheduleStore.getState().createSchedule(setup)
    useScheduleStore.getState().goToNextWeek()
    useScheduleStore.getState().createSchedule(setup)
    useScheduleStore.getState().deleteSchedule()
    await flush()
    await reload()
    const s = useScheduleStore.getState()
    expect(s.schedules.map((x) => x.id)).toEqual(["2026-08-10"])
    expect(s.staff.every((x) => x.scheduleId === "2026-08-10")).toBe(true)
  })
})

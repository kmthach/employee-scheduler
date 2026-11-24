import "fake-indexeddb/auto"
import { beforeEach, describe, expect, it } from "vitest"

import { getItem, setItem } from "./idb"
import {
  clearState,
  loadState,
  parseStored,
  saveState,
  serialize,
} from "./persistence"
import type { PersistedData } from "./persistence"

const sample = (): PersistedData => ({
  schedules: [
    { id: "2026-08-10", status: "draft", createdAt: "t", updatedAt: "t" },
  ],
  staff: [
    { id: "p1", scheduleId: "2026-08-10", name: "Ann", maxWeeklyHours: 40 },
  ],
  shifts: [
    {
      id: "am",
      scheduleId: "2026-08-10",
      startTime: "07:00",
      endTime: "15:00",
    },
  ],
  assignments: [
    {
      id: "a1",
      scheduleId: "2026-08-10",
      staffId: "p1",
      shiftId: "am",
      dayOfWeek: 0,
    },
  ],
  publishedSnapshots: {},
  autoRemovedKeys: {},
  transactionsPerStaffHour: { "2026-08-10": 12 },
  transactions: [
    {
      id: "t1",
      scheduleId: "2026-08-10",
      dayOfWeek: 2,
      hour: 9,
      transactionCount: 30,
    },
  ],
  transactionReports: {
    "2026-08-10": { fileName: null, savedAt: "t" },
  },
})

beforeEach(async () => {
  await clearState()
})

describe("parseStored", () => {
  it("accepts what serialize produces", () => {
    const data = sample()
    expect(parseStored(JSON.parse(JSON.stringify(serialize(data))))).toEqual(
      data
    )
  })

  it.each([
    ["not an object", "garbage"],
    ["null", null],
    ["unknown version", { version: 99, data: sample() }],
    ["missing data", { version: 1 }],
  ])("rejects %s", (_, raw) => {
    expect(parseStored(raw)).toBeNull()
  })

  const broken = (mutate: (d: PersistedData) => void) => {
    const d = sample()
    mutate(d)
    return parseStored(serialize(d))
  }

  it("rejects wrong field types and out-of-range values", () => {
    expect(
      broken((d) => ((d.staff[0] as unknown as { name: number }).name = 5))
    ).toBeNull()
    expect(broken((d) => (d.staff[0].maxWeeklyHours = -1))).toBeNull()
    expect(broken((d) => (d.shifts[0].startTime = "25:00"))).toBeNull()
    expect(
      broken((d) => ((d.assignments[0] as { dayOfWeek: number }).dayOfWeek = 7))
    ).toBeNull()
    expect(broken((d) => (d.transactions[0].hour = 24))).toBeNull()
    expect(broken((d) => (d.transactions[0].transactionCount = -3))).toBeNull()
  })

  it("rejects dangling references and duplicate schedules", () => {
    expect(broken((d) => (d.assignments[0].staffId = "ghost"))).toBeNull()
    expect(broken((d) => (d.assignments[0].shiftId = "ghost"))).toBeNull()
    expect(broken((d) => (d.staff[0].scheduleId = "2026-08-17"))).toBeNull()
    expect(broken((d) => d.schedules.push({ ...d.schedules[0] }))).toBeNull()
  })

  it("rejects an assignment whose employee belongs to another schedule", () => {
    const d = sample()
    d.schedules.push({
      id: "2026-08-17",
      status: "draft",
      createdAt: "t",
      updatedAt: "t",
    })
    d.assignments[0].scheduleId = "2026-08-17"
    expect(parseStored(serialize(d))).toBeNull()
  })
})

describe("loadState / saveState", () => {
  it("reports empty when nothing is stored", async () => {
    expect(await loadState()).toEqual({ status: "empty" })
  })

  it("round-trips through IndexedDB", async () => {
    await saveState(sample())
    expect(await loadState()).toEqual({ status: "ok", data: sample() })
  })

  it("sets corrupt data aside and then starts empty", async () => {
    await setItem("state", { version: 1, data: { schedules: "nope" } })
    expect(await loadState()).toEqual({ status: "corrupt" })
    expect(await getItem("state-corrupt-backup")).toEqual({
      version: 1,
      data: { schedules: "nope" },
    })
    expect(await loadState()).toEqual({ status: "empty" })
  })

  it("clearState removes everything", async () => {
    await saveState(sample())
    await clearState()
    expect(await loadState()).toEqual({ status: "empty" })
  })
})

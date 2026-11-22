import { afterAll, describe, expect, it } from "vitest"
import { terminateLoadedRuntimeThreads } from "cp-sat-wasm"

import {
  generateSchedule,
  type AutoScheduleInput,
  type AutoScheduleResult,
} from "./auto-schedule"
import { computeCoverage } from "./coverage"
import { validateForPublish } from "./draft"
import { shiftDurationHours } from "./time"
import type {
  Assignment,
  DayOfWeek,
  Shift,
  Staff,
  TransactionRecord,
} from "./types"

afterAll(async () => {
  await terminateLoadedRuntimeThreads()
})

const staff = (id: string, maxWeeklyHours: number): Staff => ({
  id,
  scheduleId: "w",
  name: id,
  maxWeeklyHours,
})
const shift = (id: string, startTime: string, endTime: string): Shift => ({
  id,
  scheduleId: "w",
  startTime,
  endTime,
})
const team = (count: number, max: number | number[]) =>
  Array.from({ length: count }, (_, i) =>
    staff(`e${i}`, Array.isArray(max) ? max[i % max.length] : max)
  )

/** Transactions from a function of (day, hour); zero rows are omitted like a real import. */
function transactions(
  fn: (day: DayOfWeek, hour: number) => number,
  hours: [number, number] = [7, 22]
): TransactionRecord[] {
  const rows: TransactionRecord[] = []
  for (let d = 0; d < 7; d++) {
    for (let h = hours[0]; h <= hours[1]; h++) {
      rows.push({
        id: `${d}-${h}`,
        scheduleId: "w",
        dayOfWeek: d as DayOfWeek,
        hour: h,
        transactionCount: fn(d as DayOfWeek, h),
      })
    }
  }
  return rows
}

const uniform = (n: number) => () => n
const peaks = (_d: DayOfWeek, h: number) =>
  (h >= 11 && h <= 13) || (h >= 17 && h <= 19) ? 75 : 20

const SHIFTS = [
  shift("early", "07:00", "15:00"),
  shift("mid", "11:00", "19:00"),
  shift("late", "15:00", "23:00"),
  shift("lunch", "10:00", "14:00"),
]
const OVERLAPPING = [
  shift("a", "06:00", "12:00"),
  shift("b", "09:00", "15:00"),
  shift("c", "11:00", "17:00"),
  shift("d", "14:00", "20:00"),
  shift("e", "17:00", "23:00"),
  shift("f", "11:00", "14:00"),
]

const run = (
  input: AutoScheduleInput,
  transactionsPerStaffHour?: number,
  maxSolveSeconds = 2
) =>
  generateSchedule(input, {
    executor: "direct",
    transactionsPerStaffHour,
    maxSolveSeconds,
  })

const toAssignments = (r: AutoScheduleResult): Assignment[] =>
  r.assignments.map((a, i) => ({ id: `a${i}`, scheduleId: "w", ...a }))

/** Invariants every generated roster must satisfy. */
function assertValid(input: AutoScheduleInput, result: AutoScheduleResult) {
  const assignments = toAssignments(result)
  const validation = validateForPublish({
    staff: input.staff,
    shifts: input.shifts,
    assignments,
  })
  expect(validation.conflicts).toEqual([]) // no overlapping assignments
  // Maximum weekly hours are soft: any overtime must be reported, nothing is hidden.
  expect(validation.overMax.map((o) => o.staff.id).sort()).toEqual(
    result.overMaxStaff.map((o) => o.staffId).sort()
  )
  const staffIds = new Set(input.staff.map((s) => s.id))
  const shiftIds = new Set(input.shifts.map((s) => s.id))
  const keys = assignments.map(
    (a) => `${a.staffId}|${a.dayOfWeek}|${a.shiftId}`
  )
  expect(new Set(keys).size).toBe(keys.length) // no duplicates
  for (const a of assignments) {
    expect(staffIds.has(a.staffId)).toBe(true)
    expect(shiftIds.has(a.shiftId)).toBe(true)
  }
}

const staffedAt = (
  input: AutoScheduleInput,
  result: AutoScheduleResult,
  day: number,
  hour: number
) =>
  computeCoverage(input.shifts, toAssignments(result), input.transactions).days[
    day
  ].rows.find((r) => r.hour === hour)!.staffHours

describe("generateSchedule", () => {
  it("covers uniform demand across all seven days", async () => {
    const input = {
      staff: team(6, 40),
      shifts: SHIFTS,
      transactions: transactions(uniform(30), [8, 21]),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.status).toBe("optimal")
    expect(result.unstaffedHours).toEqual([])
    for (let d = 0; d < 7; d++) {
      expect(result.assignments.some((a) => a.dayOfWeek === d)).toBe(true)
    }
  })

  it("staffs busy lunch/dinner hours more than quiet hours", async () => {
    const input = {
      staff: team(8, 40),
      shifts: OVERLAPPING,
      transactions: transactions(peaks),
    }
    const result = await run(input)
    assertValid(input, result)
    for (let d = 0; d < 7; d++) {
      expect(staffedAt(input, result, d, 12)).toBeGreaterThan(
        staffedAt(input, result, d, 15)
      )
    }
  })

  it("uses overtime instead of leaving hours unstaffed when capacity is very low", async () => {
    const input = {
      staff: team(2, 8),
      shifts: SHIFTS,
      transactions: transactions(peaks),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.unstaffedHours).toEqual([])
    expect(result.overMaxStaff.length).toBeGreaterThan(0)
    expect(result.notes.join(" ")).toMatch(/over their maximum/i)
  })

  it("does not use overtime when capacity is ample", async () => {
    const input = {
      staff: team(10, 40),
      shifts: SHIFTS,
      transactions: transactions(peaks),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.overMaxStaff).toEqual([])
    expect(result.unstaffedHours).toEqual([])
  })

  it("uses overtime only to staff empty hours, and spreads it out", async () => {
    // One template per hour block, so every hour needs a person and capacity is short.
    const input = {
      staff: team(3, 40),
      shifts: [shift("day", "08:00", "20:00")],
      transactions: transactions(peaks, [8, 19]),
    }
    const result = await run(input)
    assertValid(input, result)
    // 7 days × 12 h = 84 h needed; 3 × 40 = 120 h capacity, so no overtime
    expect(result.overMaxStaff).toEqual([])

    const tight = { ...input, staff: team(2, 40) } // 80 h < 84 h
    const r2 = await run(tight)
    assertValid(tight, r2)
    expect(r2.unstaffedHours).toEqual([])
    const total = r2.overMaxStaff.reduce((n, o) => n + o.overHours, 0)
    // 7 indivisible 12 h shifts: two people can take 3 each (36 h); the 7th makes one person 48 h
    expect(total).toBe(8)
    // never overtime just to add a second person to an already staffed hour
    expect(Object.values(r2.hoursByStaff).reduce((n, h) => n + h, 0)).toBe(84)
  })

  it("leaves hours unstaffed only when no shift template covers them", async () => {
    const input = {
      staff: team(4, 40),
      shifts: [shift("day", "08:00", "16:00")],
      transactions: transactions(uniform(30), [8, 21]),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.unstaffedHours.every((u) => u.hour >= 16)).toBe(true)
    expect(result.unstaffedHours.length).toBeGreaterThan(0)
    expect(result.notes.join(" ")).toMatch(/shift template/i)
  })

  it("balances utilization across employees with different maximums", async () => {
    const maxes = [40, 30, 16]
    const input = {
      staff: team(6, maxes),
      shifts: OVERLAPPING,
      transactions: transactions(peaks),
    }
    const result = await run(input)
    assertValid(input, result)
    const utils = input.staff.map(
      (s) => result.hoursByStaff[s.id] / s.maxWeeklyHours
    )
    expect(Math.min(...utils)).toBeGreaterThan(0.5)
    expect(Math.max(...utils) - Math.min(...utils)).toBeLessThan(0.35)
  })

  it("never gives one employee overlapping templates", async () => {
    const input = {
      staff: team(10, 40),
      shifts: OVERLAPPING,
      transactions: transactions(peaks),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.assignments.length).toBeGreaterThan(0)
  })

  it("keeps every hour with transactions staffed when staff is short", async () => {
    const input = {
      staff: team(2, 20),
      shifts: OVERLAPPING,
      transactions: transactions(uniform(75)),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.unstaffedHours).toEqual([])
    expect(result.overMaxStaff.length).toBeGreaterThan(0)
    expect(result.shortfalls).toEqual([]) // no target configured
    expect(result.surplusStaffHours).toBe(0)
  })

  it("reports shortfalls only when an explicit target is configured", async () => {
    const input = {
      staff: team(2, 20),
      shifts: OVERLAPPING,
      transactions: transactions(uniform(75)),
    }
    const result = await run(input, 15)
    assertValid(input, result)
    expect(result.shortfalls.length).toBeGreaterThan(0)
    for (const s of result.shortfalls) {
      expect(s.staffed).toBeLessThan(s.required)
    }
  })

  it("rejects an explicit target that is not a positive number", async () => {
    const input = { staff: team(1, 40), shifts: SHIFTS, transactions: [] }
    await expect(run(input, 0)).rejects.toThrow(RangeError)
    await expect(run(input, Number.NaN)).rejects.toThrow(RangeError)
  })

  it("is scale invariant: only relative demand matters", async () => {
    const make = (k: number) => ({
      staff: team(6, [40, 30]),
      shifts: OVERLAPPING,
      transactions: transactions((d, h) => k * peaks(d, h)),
    })
    const base = await run(make(1))
    const doubled = await run(make(2))
    expect(doubled.assignments).toEqual(base.assignments)
  })

  it("splits scarce capacity roughly in proportion to demand", async () => {
    const input = {
      staff: team(6, 24),
      shifts: OVERLAPPING,
      transactions: transactions((_d, h) => (h >= 11 && h <= 13 ? 90 : 30)),
    }
    const result = await run(input)
    assertValid(input, result)
    let peak = 0
    let quiet = 0
    for (let d = 0; d < 7; d++) {
      peak += staffedAt(input, result, d, 12)
      quiet += staffedAt(input, result, d, 16)
    }
    expect(peak).toBeGreaterThan(quiet)
  })

  it("returns an empty draft with a note when there is no transaction data", async () => {
    const input = { staff: team(3, 40), shifts: SHIFTS, transactions: [] }
    const result = await run(input)
    expect(result.assignments).toEqual([])
    expect(result.notes.length).toBeGreaterThan(0)
    expect(Object.keys(result.hoursByStaff)).toHaveLength(3)
  })

  it("returns an empty draft when every transaction count is zero", async () => {
    const input = {
      staff: team(3, 40),
      shifts: SHIFTS,
      transactions: transactions(uniform(0)),
    }
    const result = await run(input)
    expect(result.assignments).toEqual([])
    expect(result.shortfalls).toEqual([])
  })

  it("does not schedule days that have no demand", async () => {
    const input = {
      staff: team(4, 40),
      shifts: SHIFTS,
      transactions: transactions((d) => (d === 2 ? 45 : 0), [8, 20]),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.assignments.length).toBeGreaterThan(0)
    expect(result.assignments.every((a) => a.dayOfWeek === 2)).toBe(true)
  })

  it("ignores employees with no capacity and invalid shift templates", async () => {
    const input = {
      staff: [staff("zero", 0), staff("ok", 40)],
      shifts: [...SHIFTS, shift("bad", "12:00", "12:00")],
      transactions: transactions(uniform(30), [9, 18]),
    }
    const result = await run(input)
    expect(result.hoursByStaff.zero).toBe(0)
    expect(result.assignments.every((a) => a.staffId === "ok")).toBe(true)
    expect(result.assignments.every((a) => a.shiftId !== "bad")).toBe(true)
  })

  it("honours a custom transactions-per-staff-hour target", async () => {
    const base = {
      staff: team(10, 40),
      shifts: SHIFTS,
      transactions: transactions(uniform(30), [9, 18]),
    }
    const loose = await run(base, 30) // 1 required per hour
    const strict = await run(base, 10) // 3 required per hour
    expect(strict.assignments.length).toBeGreaterThan(loose.assignments.length)
  }, 30_000)

  it("is deterministic for the same input", async () => {
    const input = {
      staff: team(8, [40, 30, 24]),
      shifts: OVERLAPPING,
      transactions: transactions(peaks),
    }
    const first = await run(input)
    const second = await run(input)
    expect(second.assignments).toEqual(first.assignments)
  }, 30_000)

  it("solves a larger roster within the time limit", async () => {
    const input = {
      staff: team(30, [40, 32, 24, 20]),
      shifts: [
        ...OVERLAPPING,
        shift("g", "07:30", "13:30"),
        shift("h", "12:00", "20:00"),
      ],
      transactions: transactions((d, h) => peaks(d, h) + (d >= 5 ? 20 : 0)),
    }
    const result = await generateSchedule(input, {
      executor: "direct",
      maxSolveSeconds: 5,
    })
    assertValid(input, result)
    expect(result.assignments.length).toBeGreaterThan(0)
    for (const s of input.shifts)
      expect(shiftDurationHours(s)).toBeGreaterThan(0)
  }, 60_000)
})

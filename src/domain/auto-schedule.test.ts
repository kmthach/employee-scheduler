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
  expect(validation.overMax).toEqual([]) // maximum weekly hours respected
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
    expect(result.shortfalls).toEqual([])
    console.log("Result", result)
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

  it("handles very low employee capacity", async () => {
    const input = {
      staff: team(2, 8),
      shifts: SHIFTS,
      transactions: transactions(peaks),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.shortfalls.length).toBeGreaterThan(0)
    expect(result.notes.join(" ")).toMatch(/capacity/i)
    for (const hours of Object.values(result.hoursByStaff)) {
      expect(hours).toBeLessThanOrEqual(8)
    }
  })

  it("balances utilization across employees with different maximums", async () => {
    const maxes = [40, 30, 16]
    const input = {
      staff: team(3, maxes),
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

  it("reports shortfalls when there is not enough staff", async () => {
    const input = {
      staff: team(2, 20),
      shifts: OVERLAPPING,
      transactions: transactions(uniform(75)),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.shortfalls.length).toBeGreaterThan(0)
    for (const s of result.shortfalls) {
      expect(s.staffed).toBeLessThan(s.required)
    }
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
  })

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

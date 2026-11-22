import { afterAll, describe, expect, it } from "vitest"
import { terminateLoadedRuntimeThreads } from "cp-sat-wasm"

import type { AssignmentCandidate } from "./assignment"
import {
  evaluateRoster,
  generateSchedule,
  type AutoScheduleInput,
  type AutoScheduleResult,
  type RosterMetrics,
} from "./auto-schedule"
import { validateForPublish } from "./draft"
import { shiftDurationHours, timesOverlap } from "./time"
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

/** Demand on given days only, one count for every hour in the range. */
const onDays = (days: number[], count: number, hours: [number, number]) =>
  transactions((d) => (days.includes(d) ? count : 0), hours)

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

const run = (input: AutoScheduleInput, maxSolveSeconds = 2) =>
  generateSchedule(input, { executor: "direct", maxSolveSeconds })

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
  // Maximum weekly hours are never exceeded.
  expect(validation.overMax).toEqual([])
  expect(validation.ok).toBe(true)
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

// ---------------------------------------------------------------------------------------------
// Brute-force oracle: for tiny inputs, enumerate every roster that respects overlaps and maximum
// hours and take the lexicographically best (understaffing, total minutes, fairness) tuple.
// The solver must reach exactly that tuple.
// ---------------------------------------------------------------------------------------------
const tupleOf = (m: RosterMetrics) => [
  m.understaffing,
  m.assignedMinutes,
  m.fairnessSpread,
]

function compareTuples(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

function bruteForce(input: AutoScheduleInput, perStaffHour?: number) {
  const slots: AssignmentCandidate[] = []
  for (const p of input.staff.filter((s) => s.maxWeeklyHours > 0))
    for (let d = 0; d < 7; d++)
      for (const s of input.shifts)
        slots.push({ staffId: p.id, shiftId: s.id, dayOfWeek: d as DayOfWeek })
  expect(slots.length).toBeLessThanOrEqual(14)
  const shiftById = new Map(input.shifts.map((s) => [s.id, s]))
  let best: number[] | null = null
  for (let mask = 0; mask < 1 << slots.length; mask++) {
    const chosen = slots.filter((_, i) => mask & (1 << i))
    const overlapping = chosen.some((a, i) =>
      chosen.some(
        (b, j) =>
          j > i &&
          a.staffId === b.staffId &&
          a.dayOfWeek === b.dayOfWeek &&
          timesOverlap(shiftById.get(a.shiftId)!, shiftById.get(b.shiftId)!)
      )
    )
    if (overlapping) continue
    const metrics = evaluateRoster(input, chosen, perStaffHour)
    const overMax = input.staff.some(
      (p) => metrics.hoursByStaff[p.id] * 60 > Math.round(p.maxWeeklyHours * 60)
    )
    if (overMax) continue
    const tuple = tupleOf(metrics)
    if (best === null || compareTuples(tuple, best) < 0) best = tuple
  }
  return best!
}

async function expectLexicographicOptimum(
  input: AutoScheduleInput,
  perStaffHour?: number
) {
  const result = await generateSchedule(input, {
    executor: "direct",
    maxSolveSeconds: 2,
    transactionsPerStaffHour: perStaffHour,
  })
  assertValid(input, result)
  const got = tupleOf(evaluateRoster(input, result.assignments, perStaffHour))
  expect(got).toEqual(bruteForce(input, perStaffHour))
  return result
}

/** Deterministic pseudo-random numbers so the oracle instances never change. */
function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

describe("maximum weekly hours", () => {
  it("never schedules overtime, even when hours stay understaffed", async () => {
    // One employee (max 8 h) and one 12 h template: working it would be 4 h of overtime.
    const input: AutoScheduleInput = {
      staff: [staff("a", 8)],
      shifts: [shift("day", "08:00", "20:00")],
      transactions: onDays([0], 10, [8, 19]),
    }
    const result = await expectLexicographicOptimum(input)
    expect(result.assignments).toEqual([])
    expect(result.understaffedStaffHours).toBe(12)
    expect(result.notes.join(" ")).toMatch(/maximum weekly hours/i)
  })

  it("allows a roster exactly at the maximum", async () => {
    const input: AutoScheduleInput = {
      staff: [staff("a", 12)],
      shifts: [shift("day", "08:00", "20:00")],
      transactions: onDays([0], 10, [8, 19]),
    }
    const result = await expectLexicographicOptimum(input)
    expect(result.hoursByStaff.a).toBe(12)
    expect(result.understaffedStaffHours).toBe(0)
  })

  it("staffs what fits within each maximum and reports the rest", async () => {
    // 30 tx per hour need 2 people for 12 hours. a (40 h) covers one place; b (8 h) cannot take
    // the 12 h template without overtime, so one place stays open.
    const input: AutoScheduleInput = {
      staff: [staff("a", 40), staff("b", 8)],
      shifts: [shift("day", "08:00", "20:00")],
      transactions: onDays([0], 30, [8, 19]),
    }
    const result = await expectLexicographicOptimum(input)
    expect(result.hoursByStaff).toEqual({ a: 12, b: 0 })
    expect(result.understaffedStaffHours).toBe(12)
  })

  it("holds for every maximum, including fractional ones", async () => {
    const input: AutoScheduleInput = {
      staff: [staff("a", 7.5), staff("b", 15.5)],
      shifts: [
        shift("short", "08:00", "12:00"),
        shift("long", "10:00", "18:00"),
      ],
      transactions: onDays([0, 1, 2], 20, [8, 17]),
    }
    const result = await run(input)
    assertValid(input, result)
    for (const p of input.staff) {
      expect(result.hoursByStaff[p.id]).toBeLessThanOrEqual(p.maxWeeklyHours)
    }
  })

  it("measures understaffing against 15 transactions per staff hour", () => {
    // Needs 1, 2, 4, 6, 3 people at 09–13h; the roster has 1, 2, 3, 3, 3.
    const counts = [10, 30, 60, 90, 45]
    const staffed = [1, 2, 3, 3, 3]
    const input: AutoScheduleInput = {
      staff: Array.from({ length: 3 }, (_, i) => staff(`p${i}`, 40)),
      shifts: counts.map((_, h) =>
        shift(`h${h}`, `${String(9 + h).padStart(2, "0")}:00`, `${10 + h}:00`)
      ),
      transactions: counts.map((c, h) => ({
        id: String(h),
        scheduleId: "w",
        dayOfWeek: 0 as DayOfWeek,
        hour: 9 + h,
        transactionCount: c,
      })),
    }
    const assignments: AssignmentCandidate[] = []
    staffed.forEach((n, h) => {
      for (let p = 0; p < n; p++) {
        assignments.push({ staffId: `p${p}`, shiftId: `h${h}`, dayOfWeek: 0 })
      }
    })
    const m = evaluateRoster(input, assignments)
    expect(m.shortfalls.map((s) => [s.hour, s.required - s.staffed])).toEqual([
      [11, 1],
      [12, 3],
    ])
    expect(m.understaffing).toBe(4)
  })

  it("is optimal for a non-default transactions per staff hour too", async () => {
    // 30 transactions per hour need 3 people at 10 per hour; a (max 12) and b (max 12) can each
    // cover only one 12 h day-shift, so exactly one place per hour stays open.
    const input: AutoScheduleInput = {
      staff: [staff("a", 12), staff("b", 12)],
      shifts: [shift("day", "08:00", "20:00")],
      transactions: onDays([0], 30, [8, 19]),
    }
    const result = await expectLexicographicOptimum(input, 10)
    expect(result.understaffedStaffHours).toBe(12)
    expect(result.transactionsPerStaffHour).toBe(10)
  })

  it("never lets fairness worsen understaffing", async () => {
    // Mon–Thu, 12 busy hours each (1 required). a (max 12) and b (max 36) share one 12 h
    // template: b covers three days, a one. Fairness cannot change who is staffed or add hours.
    const input: AutoScheduleInput = {
      staff: [staff("a", 12), staff("b", 36)],
      shifts: [shift("day", "08:00", "20:00")],
      transactions: onDays([0, 1, 2, 3], 10, [8, 19]),
    }
    const result = await expectLexicographicOptimum(input)
    expect(result.understaffedStaffHours).toBe(0)
    expect(result.hoursByStaff).toEqual({ a: 12, b: 36 })
    expect(result.fairnessSpread).toBe(0)
  })

  it("compares utilization, not absolute hours, across different maximums", async () => {
    // 3 shifts are needed (Mon–Wed, 8 h each, 1 person). a: max 8, b: max 16. Equal
    // utilization is a=1 shift (100%) and b=2 shifts (100%), not 1.5 shifts each.
    const input: AutoScheduleInput = {
      staff: [staff("a", 8), staff("b", 16)],
      shifts: [shift("day", "08:00", "16:00")],
      transactions: onDays([0, 1, 2], 10, [8, 15]),
    }
    const result = await expectLexicographicOptimum(input)
    expect(result.hoursByStaff).toEqual({ a: 8, b: 16 })
    expect(result.fairnessSpread).toBe(0)
  })

  it("ignores employees with a maximum of 0 everywhere, including fairness", async () => {
    const input: AutoScheduleInput = {
      staff: [staff("zero", 0), staff("a", 8), staff("b", 16)],
      shifts: [shift("day", "08:00", "16:00")],
      transactions: onDays([0, 1, 2], 10, [8, 15]),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.hoursByStaff.zero).toBe(0)
    expect(result.assignments.every((a) => a.staffId !== "zero")).toBe(true)
    expect(Number.isFinite(result.fairnessSpread)).toBe(true)
    expect(result.fairnessSpread).toBe(0)
  })

  it("matches the brute-force lexicographic optimum on small random inputs", async () => {
    const rand = lcg(7)
    const templates = [
      shift("s1", "08:00", "12:00"),
      shift("s2", "10:00", "14:00"),
      shift("s3", "12:00", "20:00"),
    ]
    for (let n = 0; n < 12; n++) {
      const people = 2 + (rand() < 0.5 ? 0 : 1)
      const shifts = templates.slice(0, rand() < 0.5 ? 1 : 2)
      const maxes = [4, 8, 12, 16, 24]
      const input: AutoScheduleInput = {
        staff: Array.from({ length: people }, (_, i) =>
          staff(`p${i}`, maxes[Math.floor(rand() * maxes.length)])
        ),
        shifts,
        transactions: transactions(
          (d, h) =>
            d < 2 ? 1 + Math.floor(rand() * 9) * (h % 3 === 0 ? 3 : 1) : 0,
          [8, 13]
        ),
      }
      if (people * 7 * shifts.length > 14) continue
      await expectLexicographicOptimum(input)
    }
  }, 60_000)
})

describe("generateSchedule", () => {
  it("covers uniform demand across all seven days", async () => {
    const input = {
      staff: team(6, 40),
      shifts: SHIFTS,
      transactions: transactions(uniform(30), [8, 21]),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.unstaffedHours).toEqual([])
    for (let d = 0; d < 7; d++) {
      expect(result.assignments.some((a) => a.dayOfWeek === d)).toBe(true)
    }
  })

  it("staffs busy hours more than quiet hours", async () => {
    const input = {
      staff: team(8, 40),
      shifts: OVERLAPPING,
      transactions: transactions(peaks),
    }
    const result = await run(input)
    assertValid(input, result)
    const staffedAt = (d: number, h: number) =>
      new Set(
        result.assignments
          .filter((a) => a.dayOfWeek === d)
          .filter((a) => {
            const s = input.shifts.find((x) => x.id === a.shiftId)!
            return (
              Number(s.startTime.slice(0, 2)) <= h &&
              h < Number(s.endTime.slice(0, 2))
            )
          })
          .map((a) => a.staffId)
      ).size
    for (let d = 0; d < 7; d++) {
      expect(staffedAt(d, 12)).toBeGreaterThan(staffedAt(d, 15))
    }
  })

  it("reports understaffing instead of overtime when capacity is low", async () => {
    const input = {
      staff: team(2, 8),
      shifts: SHIFTS,
      transactions: transactions(peaks),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.understaffedStaffHours).toBeGreaterThan(0)
    expect(result.assignments.length).toBeGreaterThan(0)
    expect(result.notes.join(" ")).toMatch(/maximum weekly hours/i)
  })

  it("has no understaffing when capacity is ample", async () => {
    const input = {
      staff: team(20, 40),
      shifts: SHIFTS,
      transactions: transactions(peaks),
    }
    const result = await run(input)
    assertValid(input, result)
    expect(result.understaffedStaffHours).toBe(0)
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

  it("requirements follow the configured transactions per staff hour", async () => {
    // 60 transactions per hour need 4 people at 15 per hour, 2 at 30, 1 at 60.
    const input: AutoScheduleInput = {
      staff: team(6, 40),
      shifts: [shift("day", "08:00", "16:00")],
      transactions: onDays([0], 60, [8, 15]),
    }
    const at = (n?: number) =>
      generateSchedule(input, {
        executor: "direct",
        maxSolveSeconds: 2,
        transactionsPerStaffHour: n,
      })
    const [d15, d30, d60] = [await at(15), await at(30), await at(60)]
    expect([d15, d30, d60].map((r) => r.assignments.length)).toEqual([4, 2, 1])
    expect([d15, d30, d60].map((r) => r.transactionsPerStaffHour)).toEqual([
      15, 30, 60,
    ])
    for (const r of [d15, d30, d60]) {
      expect(r.understaffedStaffHours).toBe(0)
      assertValid(input, r)
    }
    // Omitting the option equals passing 15.
    expect((await at()).assignments).toEqual(d15.assignments)
    expect((await at()).transactionsPerStaffHour).toBe(15)
  })

  it("evaluateRoster measures understaffing against the same value", () => {
    const input: AutoScheduleInput = {
      staff: team(1, 40),
      shifts: [shift("h", "09:00", "10:00")],
      transactions: onDays([0], 60, [9, 9]),
    }
    const one: AssignmentCandidate[] = [
      { staffId: "e0", shiftId: "h", dayOfWeek: 0 },
    ]
    expect(evaluateRoster(input, one, 15).understaffing).toBe(3)
    expect(evaluateRoster(input, one, 30).understaffing).toBe(1)
    expect(evaluateRoster(input, one).understaffing).toBe(3)
  })

  it("rejects an invalid transactions per staff hour", async () => {
    const input: AutoScheduleInput = {
      staff: team(1, 40),
      shifts: SHIFTS,
      transactions: transactions(uniform(30)),
    }
    for (const bad of [0, -1, 2.5, NaN, 5000]) {
      await expect(
        generateSchedule(input, {
          executor: "direct",
          transactionsPerStaffHour: bad,
        })
      ).rejects.toThrow(RangeError)
    }
  })

  it("never exceeds maximum hours, whatever the value", async () => {
    const input = {
      staff: team(3, 16),
      shifts: SHIFTS,
      transactions: transactions(peaks),
    }
    for (const n of [1, 5, 15, 100]) {
      const result = await generateSchedule(input, {
        executor: "direct",
        maxSolveSeconds: 2,
        transactionsPerStaffHour: n,
      })
      assertValid(input, result)
    }
  })

  it("needs more staff when demand grows (fixed 15 transactions per staff hour)", async () => {
    const make = (k: number): AutoScheduleInput => ({
      staff: team(2, 40),
      shifts: [shift("day", "08:00", "16:00")],
      transactions: onDays([0], 10 * k, [8, 15]),
    })
    const light = await run(make(1)) // 10 tx -> 1 person
    const heavy = await run(make(3)) // 30 tx -> 2 people
    expect(light.understaffedStaffHours).toBe(0)
    expect(light.assignments).toHaveLength(1)
    expect(heavy.assignments).toHaveLength(2)
    expect(heavy.understaffedStaffHours).toBe(0)
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

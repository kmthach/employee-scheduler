import { describe, expect, it } from "vitest"

import { computeCoverage, formatRatio, ratio, staffedHours } from "./coverage"
import type { Assignment, DayOfWeek, Shift, TransactionRecord } from "./types"

const shift = (id: string, startTime: string, endTime: string): Shift => ({
  id,
  scheduleId: "S",
  startTime,
  endTime,
})
const asg = (
  id: string,
  staffId: string,
  shiftId: string,
  dayOfWeek: DayOfWeek = 0
): Assignment => ({ id, scheduleId: "S", staffId, shiftId, dayOfWeek })
const tx = (
  dayOfWeek: DayOfWeek,
  hour: number,
  transactionCount: number
): TransactionRecord => ({
  id: `${dayOfWeek}-${hour}`,
  scheduleId: "S",
  dayOfWeek,
  hour,
  transactionCount,
})

describe("staffedHours", () => {
  it("covers whole-hour shifts, excluding the end hour", () => {
    expect(staffedHours({ startTime: "07:00", endTime: "10:00" })).toEqual([
      7, 8, 9,
    ])
  })
  it("counts any touched hour for off-the-hour shifts", () => {
    expect(staffedHours({ startTime: "07:30", endTime: "09:15" })).toEqual([
      7, 8, 9,
    ])
  })
  it("adjacent shifts don't share an hour", () => {
    const a = staffedHours({ startTime: "07:00", endTime: "15:00" })
    const b = staffedHours({ startTime: "15:00", endTime: "23:00" })
    expect(a.filter((h) => b.includes(h))).toEqual([])
  })
  it("returns nothing for invalid times", () => {
    expect(staffedHours({ startTime: "10:00", endTime: "09:00" })).toEqual([])
    expect(staffedHours({ startTime: "xx", endTime: "09:00" })).toEqual([])
  })
})

describe("ratio helpers", () => {
  it("returns null for zero staff and formats it as a dash", () => {
    expect(ratio(10, 0)).toBeNull()
    expect(formatRatio(null)).toBe("–")
    expect(formatRatio(30.25)).toBe("30.3")
    expect(formatRatio(40)).toBe("40.0")
  })
})

describe("computeCoverage", () => {
  const shifts = [shift("am", "07:00", "11:00"), shift("mid", "09:00", "13:00")]

  it("counts employees working each hour and computes the ratio", () => {
    const c = computeCoverage(
      shifts,
      [asg("1", "a", "am"), asg("2", "b", "am"), asg("3", "c", "mid")],
      [tx(0, 7, 42), tx(0, 9, 90), tx(0, 12, 20)]
    )
    const rows = c.days[0].rows
    const at = (h: number) => rows.find((r) => r.hour === h)!
    expect(at(7)).toMatchObject({ transactions: 42, staffHours: 2, ratio: 21 })
    expect(at(9)).toMatchObject({ staffHours: 3, ratio: 30 })
    expect(at(12)).toMatchObject({ staffHours: 1, ratio: 20 })
  })

  it("does not double-count an employee with overlapping draft assignments", () => {
    const c = computeCoverage(
      shifts,
      [asg("1", "a", "am"), asg("2", "a", "mid")],
      [tx(0, 9, 10)]
    )
    expect(c.days[0].rows.find((r) => r.hour === 9)!.staffHours).toBe(1)
  })

  it("keeps days separate", () => {
    const c = computeCoverage(
      shifts,
      [asg("1", "a", "am", 1)],
      [tx(0, 7, 5), tx(1, 7, 5)]
    )
    expect(c.days[0].rows[0].staffHours).toBe(0)
    expect(c.days[0].rows[0].ratio).toBeNull()
    expect(c.days[1].rows[0].staffHours).toBe(1)
  })

  it("uses 0 transactions for staffed hours missing from the data", () => {
    const c = computeCoverage(shifts, [asg("1", "a", "mid")], [tx(0, 9, 10)])
    const row = c.days[0].rows.find((r) => r.hour === 12)!
    expect(row).toMatchObject({ transactions: 0, staffHours: 1, ratio: 0 })
  })

  it("lists hours without staff when there is demand", () => {
    const c = computeCoverage([], [], [tx(2, 8, 30)])
    expect(c.days[2].rows).toEqual([
      { hour: 8, transactions: 30, staffHours: 0, ratio: null },
    ])
    expect(c.week.totalStaffHours).toBe(0)
    expect(c.week.overallRatio).toBeNull()
    expect(c.week.averageHourlyRatio).toBeNull()
  })

  it("computes day and weekly totals independent of the day", () => {
    const c = computeCoverage(
      [shift("s", "08:00", "10:00")],
      [asg("1", "a", "s", 0), asg("2", "a", "s", 1), asg("3", "b", "s", 1)],
      [tx(0, 8, 20), tx(0, 9, 30), tx(1, 8, 100), tx(1, 9, 60)]
    )
    expect(c.days[0].totals).toEqual({
      transactions: 50,
      staffHours: 2,
      ratio: 25,
    })
    expect(c.days[1].totals).toEqual({
      transactions: 160,
      staffHours: 4,
      ratio: 40,
    })
    expect(c.week.totalTransactions).toBe(210)
    expect(c.week.totalStaffHours).toBe(6)
    expect(c.week.overallRatio).toBe(35)
  })

  it("average hourly ratio differs from the overall ratio and skips zero-staff hours", () => {
    // hourly ratios 20, 30, 40, 50 -> mean 35; a staffless hour is ignored.
    const c = computeCoverage(
      [shift("s", "08:00", "12:00")],
      [asg("1", "a", "s")],
      [tx(0, 8, 20), tx(0, 9, 30), tx(0, 10, 40), tx(0, 11, 50), tx(0, 13, 500)]
    )
    expect(c.week.averageHourlyRatio).toBe(35)
    expect(c.week.overallRatio).toBe((140 + 500) / 4)
  })

  it("ignores assignments whose shift is missing", () => {
    const c = computeCoverage([], [asg("1", "a", "gone")], [tx(0, 8, 5)])
    expect(c.days[0].rows[0].staffHours).toBe(0)
  })
})

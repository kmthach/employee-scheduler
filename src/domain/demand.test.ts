import { describe, expect, it } from "vitest"

import {
  buildDemandGrid,
  DEFAULT_TRANSACTIONS_PER_STAFF_HOUR,
  requiredStaff,
} from "./demand"
import type { TransactionRecord } from "./types"

const tx = (
  dayOfWeek: TransactionRecord["dayOfWeek"],
  hour: number,
  transactionCount: number
): TransactionRecord => ({
  id: `${dayOfWeek}-${hour}`,
  scheduleId: "s",
  dayOfWeek,
  hour,
  transactionCount,
})

describe("requiredStaff", () => {
  it("defaults to 15 transactions per staff hour", () => {
    expect(DEFAULT_TRANSACTIONS_PER_STAFF_HOUR).toBe(15)
  })

  it("rounds up and needs nobody for zero transactions", () => {
    expect(requiredStaff(0)).toBe(0)
    expect(requiredStaff(1)).toBe(1)
    expect(requiredStaff(15)).toBe(1)
    expect(requiredStaff(16)).toBe(2)
    expect(requiredStaff(52)).toBe(4)
    expect(requiredStaff(64)).toBe(5)
  })

  it("honours a custom target", () => {
    expect(requiredStaff(52, 10)).toBe(6)
    expect(requiredStaff(52, 100)).toBe(1)
  })

  it("rejects a target that is not positive", () => {
    expect(() => requiredStaff(10, 0)).toThrow(RangeError)
    expect(() => requiredStaff(10, -5)).toThrow(RangeError)
  })
})

describe("buildDemandGrid", () => {
  it("returns an all-zero 7x24 grid without data", () => {
    const grid = buildDemandGrid([])
    expect(grid).toHaveLength(7)
    expect(
      grid.every((row) => row.length === 24 && row.every((n) => n === 0))
    ).toBe(true)
  })

  it("places required staff on the right day and hour", () => {
    const grid = buildDemandGrid([tx(1, 12, 52), tx(6, 22, 5), tx(0, 9, 0)])
    expect(grid[1][12]).toBe(4)
    expect(grid[6][22]).toBe(1)
    expect(grid[0][9]).toBe(0)
    expect(grid[2][12]).toBe(0)
  })

  it("ignores out-of-range rows", () => {
    const bad = { ...tx(0, 5, 30), hour: 24 }
    expect(
      buildDemandGrid([bad])
        .flat()
        .every((n) => n === 0)
    ).toBe(true)
  })
})

import { describe, expect, it } from "vitest"

import {
  DEFAULT_TRANSACTIONS_PER_STAFF_HOUR,
  buildRequiredGrid,
  buildTransactionGrid,
  requiredStaffFor,
  validateTransactionsPerStaffHour,
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

describe("buildTransactionGrid", () => {
  it("places raw counts without any conversion", () => {
    const grid = buildTransactionGrid([
      tx(1, 12, 52),
      tx(6, 22, 5),
      tx(0, 9, 0),
    ])
    expect(grid).toHaveLength(7)
    expect(grid[1][12]).toBe(52)
    expect(grid[6][22]).toBe(5)
    expect(grid[0][9]).toBe(0)
  })

  it("ignores out-of-range rows", () => {
    const bad = { ...tx(0, 5, 30), hour: 24 }
    expect(
      buildTransactionGrid([bad])
        .flat()
        .every((n) => n === 0)
    ).toBe(true)
  })
})

describe("requiredStaffFor", () => {
  it("is 15 transactions per staff hour, at least one when there is demand", () => {
    const table: [number, number][] = [
      [0, 0],
      [5, 1],
      [15, 1],
      [16, 2],
      [30, 2],
      [45, 3],
      [60, 4],
    ]
    for (const [transactions, staff] of table) {
      expect(requiredStaffFor(transactions)).toBe(staff)
    }
    expect(DEFAULT_TRANSACTIONS_PER_STAFF_HOUR).toBe(15)
  })

  it("uses the given transactions per staff hour", () => {
    expect(requiredStaffFor(25, 10)).toBe(3)
    expect(requiredStaffFor(5, 10)).toBe(1)
    expect(requiredStaffFor(7, 1)).toBe(7)
    expect(requiredStaffFor(60, 30)).toBe(2)
    expect(requiredStaffFor(0, 10)).toBe(0)
    expect(requiredStaffFor(60)).toBe(requiredStaffFor(60, 15))
  })
})

describe("validateTransactionsPerStaffHour", () => {
  it("accepts whole numbers from 1 to 1000", () => {
    for (const ok of [1, 15, 1000]) {
      expect(validateTransactionsPerStaffHour(ok)).toBeNull()
    }
  })

  it("rejects everything else with a message", () => {
    for (const bad of [0, -3, 2.5, NaN, Infinity, 1001]) {
      expect(validateTransactionsPerStaffHour(bad)).toEqual(expect.any(String))
    }
  })
})

describe("buildRequiredGrid", () => {
  it("maps every hour independently of team size or total volume", () => {
    const grid = buildTransactionGrid([
      tx(0, 9, 5),
      tx(0, 10, 30),
      tx(1, 9, 60),
    ])
    const required = buildRequiredGrid(grid)
    expect(required[0][9]).toBe(1)
    expect(required[0][10]).toBe(2)
    expect(required[1][9]).toBe(4)
    expect(required[2][9]).toBe(0)
    // Adding unrelated demand elsewhere does not change an hour's requirement.
    const more = buildTransactionGrid([tx(0, 10, 30), tx(5, 12, 900)])
    expect(buildRequiredGrid(more)[0][10]).toBe(2)
  })

  it("applies a custom value to every hour", () => {
    const grid = buildTransactionGrid([
      tx(0, 9, 5),
      tx(0, 10, 30),
      tx(1, 9, 60),
    ])
    const required = buildRequiredGrid(grid, 30)
    expect([required[0][9], required[0][10], required[1][9]]).toEqual([1, 1, 2])
  })
})

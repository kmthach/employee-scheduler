import { describe, expect, it } from "vitest"

import {
  TRANSACTIONS_PER_STAFF_HOUR,
  buildRequiredGrid,
  buildTransactionGrid,
  requiredStaffFor,
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
    expect(TRANSACTIONS_PER_STAFF_HOUR).toBe(15)
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
})

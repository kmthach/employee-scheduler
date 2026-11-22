import type { TransactionRecord } from "./types"

/**
 * Demand helpers for the auto-scheduler. Transaction counts are a relative demand signal;
 * no productivity target is assumed. The explicit-target helpers below are used only when a
 * caller opts in with `transactionsPerStaffHour`. See algorithm.md.
 */

/** Staff needed for an hour under an explicit target. 0 transactions needs nobody. */
export function requiredStaff(
  transactions: number,
  transactionsPerStaffHour: number
): number {
  if (!(transactionsPerStaffHour > 0)) {
    throw new RangeError("transactionsPerStaffHour must be greater than 0.")
  }
  if (!(transactions > 0)) return 0
  return Math.ceil(transactions / transactionsPerStaffHour)
}

function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
}

function inRange(t: TransactionRecord): boolean {
  return t.dayOfWeek >= 0 && t.dayOfWeek <= 6 && t.hour >= 0 && t.hour <= 23
}

/** Transaction counts per day (Monday = 0) and clock hour (0–23). Hours without data are 0. */
export function buildTransactionGrid(
  transactions: TransactionRecord[]
): number[][] {
  const grid = emptyGrid()
  for (const t of transactions) {
    if (inRange(t) && t.transactionCount > 0) {
      grid[t.dayOfWeek][t.hour] += t.transactionCount
    }
  }
  return grid
}

/** Explicit-target mode: required staff per day and hour. Hours without data need 0. */
export function buildDemandGrid(
  transactions: TransactionRecord[],
  transactionsPerStaffHour: number
): number[][] {
  const grid = emptyGrid()
  for (const t of transactions) {
    if (!inRange(t)) continue
    grid[t.dayOfWeek][t.hour] += requiredStaff(
      t.transactionCount,
      transactionsPerStaffHour
    )
  }
  return grid
}

import type { TransactionRecord } from "./types"

function emptyGrid(): number[][] {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
}

/** Transaction counts per day (Monday = 0) and clock hour (0–23). Hours without data are 0. */
export function buildTransactionGrid(
  transactions: TransactionRecord[]
): number[][] {
  const grid = emptyGrid()
  for (const t of transactions) {
    if (
      t.dayOfWeek >= 0 &&
      t.dayOfWeek <= 6 &&
      t.hour >= 0 &&
      t.hour <= 23 &&
      t.transactionCount > 0
    ) {
      grid[t.dayOfWeek][t.hour] += t.transactionCount
    }
  }
  return grid
}

/**
 * Assumed staff productivity: one employee handles about 15 transactions per hour, i.e. one
 * every 4 minutes. That leaves room for work that is not a transaction (restocking, cleaning,
 * prep, breaks) in retail and food service. It is an explicit assumption, not derived from the
 * data and not configurable in the UI; change it here only.
 */
export const TRANSACTIONS_PER_STAFF_HOUR = 15

/** Staff an hour needs: at least one when there are transactions, none otherwise. */
export function requiredStaffFor(transactions: number): number {
  return transactions > 0
    ? Math.max(1, Math.ceil(transactions / TRANSACTIONS_PER_STAFF_HOUR))
    : 0
}

/** Required staff per day (Monday = 0) and clock hour. */
export function buildRequiredGrid(txGrid: number[][]): number[][] {
  return txGrid.map((day) => day.map(requiredStaffFor))
}

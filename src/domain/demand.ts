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
 * Default staff productivity: one employee handles about 15 transactions per hour, i.e. one
 * every 4 minutes. That leaves room for work that is not a transaction (restocking, cleaning,
 * prep, breaks) in retail and food service. It is an assumption, not derived from the data; the
 * manager can change it per schedule in the Auto-schedule dialog.
 */
export const DEFAULT_TRANSACTIONS_PER_STAFF_HOUR = 15

export const MAX_TRANSACTIONS_PER_STAFF_HOUR = 1000

/** Error message for an unusable value, or null when it is a whole number from 1 to 1000. */
export function validateTransactionsPerStaffHour(value: number): string | null {
  if (!Number.isInteger(value) || value < 1) {
    return "Enter a whole number of at least 1."
  }
  if (value > MAX_TRANSACTIONS_PER_STAFF_HOUR) {
    return `Enter ${MAX_TRANSACTIONS_PER_STAFF_HOUR} or less.`
  }
  return null
}

/** Staff an hour needs: at least one when there are transactions, none otherwise. */
export function requiredStaffFor(
  transactions: number,
  perStaffHour: number = DEFAULT_TRANSACTIONS_PER_STAFF_HOUR
): number {
  return transactions > 0
    ? Math.max(1, Math.ceil(transactions / perStaffHour))
    : 0
}

/** Required staff per day (Monday = 0) and clock hour. */
export function buildRequiredGrid(
  txGrid: number[][],
  perStaffHour: number = DEFAULT_TRANSACTIONS_PER_STAFF_HOUR
): number[][] {
  return txGrid.map((day) =>
    day.map((tx) => requiredStaffFor(tx, perStaffHour))
  )
}

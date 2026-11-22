import type { TransactionRecord } from "./types"

/**
 * Demand-to-staffing assumption: one staff member can handle this many transactions in an hour.
 * Transaction counts are a proxy for demand, so required staff = ceil(transactions / target).
 * Defined here once and passed as an option; see algorithm.md.
 */
export const DEFAULT_TRANSACTIONS_PER_STAFF_HOUR = 15

/** Staff needed for an hour with the given transaction count. 0 transactions needs nobody. */
export function requiredStaff(
  transactions: number,
  transactionsPerStaffHour = DEFAULT_TRANSACTIONS_PER_STAFF_HOUR
): number {
  if (!(transactionsPerStaffHour > 0)) {
    throw new RangeError("transactionsPerStaffHour must be greater than 0.")
  }
  if (!(transactions > 0)) return 0
  return Math.ceil(transactions / transactionsPerStaffHour)
}

/** Required staff per day (Monday = 0) and clock hour (0–23). Hours without data need 0. */
export function buildDemandGrid(
  transactions: TransactionRecord[],
  transactionsPerStaffHour = DEFAULT_TRANSACTIONS_PER_STAFF_HOUR
): number[][] {
  const grid = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  for (const t of transactions) {
    if (t.dayOfWeek < 0 || t.dayOfWeek > 6 || t.hour < 0 || t.hour > 23)
      continue
    grid[t.dayOfWeek][t.hour] += requiredStaff(
      t.transactionCount,
      transactionsPerStaffHour
    )
  }
  return grid
}

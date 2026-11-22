import { parseTime } from "./time"
import type { Assignment, DayOfWeek, Shift, TransactionRecord } from "./types"

export interface HourCoverage {
  hour: number // 0–23
  transactions: number
  /** Distinct employees working any part of this clock hour. */
  staffHours: number
  /** transactions / staffHours, or null when nobody is working. */
  ratio: number | null
}

export interface CoverageTotals {
  transactions: number
  staffHours: number
  ratio: number | null
}

export interface DayCoverage {
  dayOfWeek: DayOfWeek
  rows: HourCoverage[]
  totals: CoverageTotals
}

export interface WeekSummary {
  totalTransactions: number
  totalStaffHours: number
  /** Total transactions / total staff hours. */
  overallRatio: number | null
  /** Mean of the hourly ratios over hours that have staff. */
  averageHourlyRatio: number | null
}

export interface WeekCoverage {
  days: DayCoverage[]
  week: WeekSummary
}

export function ratio(transactions: number, staffHours: number): number | null {
  return staffHours > 0 ? transactions / staffHours : null
}

/** One decimal place, or "–" when there is no ratio. */
export function formatRatio(value: number | null): string {
  return value === null ? "–" : value.toFixed(1)
}

/** Clock hours a shift touches: 07:30–15:30 touches 7 through 15. */
export function staffedHours(
  shift: Pick<Shift, "startTime" | "endTime">
): number[] {
  const start = parseTime(shift.startTime)
  const end = parseTime(shift.endTime)
  if (start === null || end === null || end <= start) return []
  const first = Math.floor(start / 60)
  const last = Math.ceil(end / 60) - 1
  return Array.from({ length: last - first + 1 }, (_, i) => first + i)
}

/**
 * Hourly coverage for every day of one schedule. Rows are the hours present in the transaction
 * data plus any hour a worked shift touches (the same rows for every day); hours without
 * transaction data count as 0 transactions.
 */
export function computeCoverage(
  shifts: Shift[],
  assignments: Assignment[],
  transactions: TransactionRecord[]
): WeekCoverage {
  const shiftHours = new Map(shifts.map((s) => [s.id, staffedHours(s)]))

  // day -> hour -> distinct staff ids (a draft overlap never double-counts an employee)
  const working = new Map<string, Set<string>>()
  const hourSet = new Set<number>(transactions.map((t) => t.hour))
  for (const a of assignments) {
    for (const hour of shiftHours.get(a.shiftId) ?? []) {
      hourSet.add(hour)
      const key = `${a.dayOfWeek}-${hour}`
      const set = working.get(key) ?? new Set<string>()
      set.add(a.staffId)
      working.set(key, set)
    }
  }
  const demand = new Map(
    transactions.map((t) => [`${t.dayOfWeek}-${t.hour}`, t.transactionCount])
  )
  const hours = [...hourSet].sort((a, b) => a - b)

  const hourlyRatios: number[] = []
  const days: DayCoverage[] = Array.from({ length: 7 }, (_, d) => {
    const rows = hours.map((hour): HourCoverage => {
      const tx = demand.get(`${d}-${hour}`) ?? 0
      const staff = working.get(`${d}-${hour}`)?.size ?? 0
      const r = ratio(tx, staff)
      if (r !== null) hourlyRatios.push(r)
      return { hour, transactions: tx, staffHours: staff, ratio: r }
    })
    const tx = rows.reduce((n, r) => n + r.transactions, 0)
    const staff = rows.reduce((n, r) => n + r.staffHours, 0)
    return {
      dayOfWeek: d as DayOfWeek,
      rows,
      totals: { transactions: tx, staffHours: staff, ratio: ratio(tx, staff) },
    }
  })

  const totalTransactions = days.reduce((n, d) => n + d.totals.transactions, 0)
  const totalStaffHours = days.reduce((n, d) => n + d.totals.staffHours, 0)
  return {
    days,
    week: {
      totalTransactions,
      totalStaffHours,
      overallRatio: ratio(totalTransactions, totalStaffHours),
      averageHourlyRatio:
        hourlyRatios.length > 0
          ? hourlyRatios.reduce((n, r) => n + r, 0) / hourlyRatios.length
          : null,
    },
  }
}

import type { AssignmentCandidate } from "./assignment"
import { staffedHours } from "./coverage"
import { buildDemandGrid, buildTransactionGrid, requiredStaff } from "./demand"
import { shiftDurationHours, timesOverlap } from "./time"
import type { DayOfWeek, Shift, Staff, TransactionRecord } from "./types"

/**
 * Auto-scheduler: models the week as a constraint problem and solves it with OR-Tools CP-SAT.
 * See algorithm.md for the full description. Pure domain code: no React or Zustand.
 */

/**
 * Default mode (no target): transactions are a relative demand signal. The k-th employee in an
 * hour with a share `s` of the week's transactions earns `DEMAND_SCALE · s / k` (concave, so
 * capacity spreads in proportion to demand). Only shares matter, never absolute counts.
 */
export const DEMAND_SCALE = 1_000_000
/** Penalty per staffed hour with no transactions. Tiny: only keeps idle hours empty. */
export const IDLE_WEIGHT = 1
/** Cost of one permille of utilization spread, relative to the demand gains above. A tuning knob. */
export const FAIRNESS_WEIGHT = 100

/**
 * Maximum weekly hours are a soft limit (they are a warning, not a restriction, everywhere else
 * in the app): overtime is allowed but costs `OVERTIME_WEIGHT_PER_HOUR` per hour.
 * Ordering that matters (default mode): COVERED_HOUR_BONUS ≫ OVERTIME_WEIGHT_PER_HOUR >
 * DEMAND_SCALE / 2 (the largest gain of a 2nd or later employee in an hour). So overtime is used
 * to staff an hour that would otherwise have nobody, never just to add staff to a staffed hour.
 */
export const COVERED_HOUR_BONUS = 50_000_000
export const OVERTIME_WEIGHT_PER_HOUR = 600_000
/** Extra cost per minute of the largest individual overtime, so overtime is spread out. */
export const OVERTIME_SPREAD_WEIGHT = 100

/** Explicit-target mode only: covering demand ≫ not overstaffing ≫ fairness. */
export const SHORTFALL_WEIGHT = 10_000
export const SURPLUS_WEIGHT = 300
export const SPREAD_WEIGHT = 1
/** Explicit-target mode overtime: above SURPLUS_WEIGHT, below what a shortfall hour costs. */
export const TARGET_OVERTIME_WEIGHT_PER_HOUR = 1_200

const DEFAULT_MAX_SOLVE_SECONDS = 5
const RANDOM_SEED = 1

export interface AutoScheduleInput {
  staff: Staff[]
  shifts: Shift[]
  transactions: TransactionRecord[]
}

export interface AutoScheduleOptions {
  /**
   * Optional explicit target: required staff = ceil(transactions / this). Omitted by default;
   * without it, transaction counts only act as relative demand weights. No caller sets it today.
   */
  transactionsPerStaffHour?: number
  /** "worker" keeps the UI responsive (default); "direct" blocks but is simpler in tests. */
  executor?: "worker" | "direct"
  /** Solver time limit; also used as the deterministic time limit so results are reproducible. */
  maxSolveSeconds?: number
  signal?: AbortSignal
}

export interface Shortfall {
  dayOfWeek: DayOfWeek
  hour: number
  required: number
  staffed: number
}

export interface UnstaffedHour {
  dayOfWeek: DayOfWeek
  hour: number
  transactions: number
}

export interface OverMaxStaff {
  staffId: string
  hours: number
  maxWeeklyHours: number
  overHours: number
}

export interface AutoScheduleResult {
  /** IDs and scheduleId are added by the caller. */
  assignments: AssignmentCandidate[]
  /** "optimal" = proven best; "feasible" = time limit hit, best found (still valid). */
  status: "optimal" | "feasible"
  /** Hours with transactions but nobody staffed (same marker as Coverage "No staff"). */
  unstaffedHours: UnstaffedHour[]
  /** Explicit-target mode only: hours below the required level. Empty otherwise. */
  shortfalls: Shortfall[]
  /** Explicit-target mode only: staff-hours above the required level. 0 otherwise. */
  surplusStaffHours: number
  hoursByStaff: Record<string, number>
  /** Employees scheduled above their maximum weekly hours (the generator minimizes this). */
  overMaxStaff: OverMaxStaff[]
  notes: string[]
}

function emptyResult(staff: Staff[], notes: string[]): AutoScheduleResult {
  return {
    assignments: [],
    status: "optimal",
    unstaffedHours: [],
    shortfalls: [],
    surplusStaffHours: 0,
    hoursByStaff: Object.fromEntries(staff.map((s) => [s.id, 0])),
    overMaxStaff: [],
    notes,
  }
}

export async function generateSchedule(
  input: AutoScheduleInput,
  options: AutoScheduleOptions = {}
): Promise<AutoScheduleResult> {
  const target = options.transactionsPerStaffHour
  const explicit = target !== undefined
  if (explicit) requiredStaff(1, target) // RangeError if not a positive number
  const txGrid = buildTransactionGrid(input.transactions)
  const demand = explicit ? buildDemandGrid(input.transactions, target) : txGrid
  const totalTx = txGrid.flat().reduce((n, v) => n + v, 0)
  const people = input.staff.filter((s) => s.maxWeeklyHours > 0)
  const shifts = input.shifts.filter((s) => shiftDurationHours(s) > 0)

  if (totalTx <= 0) {
    return emptyResult(input.staff, ["No transaction demand to schedule for."])
  }
  if (people.length === 0) {
    return emptyResult(input.staff, [
      "No employees with maximum weekly hours above 0.",
    ])
  }
  if (shifts.length === 0) {
    return emptyResult(input.staff, ["No valid shift templates."])
  }

  // Loaded lazily: keeps the WASM runtime out of the main bundle and out of trivial runs.
  const { CpModel, CpSat, LinearExpr, weightedSum } =
    await import("cp-sat-wasm")

  const days = [0, 1, 2, 3, 4, 5, 6] as const
  const minutesOf = (s: Shift) => Math.round(shiftDurationHours(s) * 60)
  const touched = new Map(shifts.map((s) => [s.id, staffedHours(s)]))

  const model = new CpModel()
  const x = people.map((p) =>
    days.map((d) =>
      shifts.map((s) => model.newBoolVar(`x_${p.id}_${d}_${s.id}`))
    )
  )

  // Hard: one employee never works two overlapping shifts on the same day.
  for (let p = 0; p < people.length; p++) {
    for (const d of days) {
      for (let a = 0; a < shifts.length; a++) {
        for (let b = a + 1; b < shifts.length; b++) {
          if (timesOverlap(shifts[a], shifts[b])) {
            model.addAtMostOne([x[p][d][a], x[p][d][b]])
          }
        }
      }
    }
  }

  // Soft: maximum weekly hours. over[e] = minutes beyond the maximum; it is penalized below.
  const util = [] as ReturnType<typeof model.newIntVar>[]
  const weeklyMinutes: InstanceType<typeof LinearExpr>[] = []
  const overs = [] as ReturnType<typeof model.newIntVar>[]
  people.forEach((person, p) => {
    const minuteTerms = days.flatMap((d) =>
      shifts.map((s, i) => x[p][d][i].times(minutesOf(s)))
    )
    const minutes = LinearExpr.from(LinearExpr.sum(minuteTerms))
    weeklyMinutes.push(minutes)
    const maxMinutes = Math.round(person.maxWeeklyHours * 60)
    const over = model.newIntVar(0, 7 * 24 * 60, `over_${person.id}`)
    model.add(minutes.minus(over).le(maxMinutes))
    model.add(over.minus(minutes).le(0))
    overs.push(over)
    // Fairness: utilization of this employee's own maximum, in permille, ignoring overtime.
    const u = model.newIntVar(0, 1000, `util_${person.id}`)
    model.addDivisionEquality(u, minutes.minus(over).times(1000), maxMinutes)
    util.push(u)
  })

  // Symmetry breaking: employees with the same maximum are interchangeable, so order their
  // weekly minutes. This removes equivalent solutions and speeds up proving optimality.
  const lastWithMax = new Map<number, number>()
  people.forEach((person, p) => {
    const prev = lastWithMax.get(person.maxWeeklyHours)
    if (prev !== undefined) model.add(weeklyMinutes[prev].ge(weeklyMinutes[p]))
    lastWithMax.set(person.maxWeeklyHours, p)
  })

  // Soft: demand per (day, hour).
  const objVars: Array<
    ReturnType<typeof model.newIntVar> | ReturnType<typeof model.newBoolVar>
  > = []
  const objCoeffs: number[] = []
  for (const d of days) {
    for (let h = 0; h < 24; h++) {
      const terms = []
      for (let p = 0; p < people.length; p++) {
        for (let i = 0; i < shifts.length; i++) {
          if (touched.get(shifts[i].id)!.includes(h)) terms.push(x[p][d][i])
        }
      }
      if (terms.length === 0) continue
      const tx = txGrid[d][h]
      const staffed = LinearExpr.from(LinearExpr.sum(terms))
      if (!explicit) {
        if (tx <= 0) {
          // No transactions: staffing this hour has no demand value.
          for (const v of terms) {
            objVars.push(v)
            objCoeffs.push(IDLE_WEIGHT)
          }
          continue
        }
        // Diminishing returns: k-th employee earns DEMAND_SCALE · share / k.
        const covered = []
        for (let k = 1; k <= people.length; k++) {
          const proportional = Math.round((DEMAND_SCALE * tx) / (totalTx * k))
          if (proportional <= 0) break
          // The first employee also earns the flat bonus: an hour with transactions should
          // never be left with nobody if overtime can fix it.
          const gain =
            k === 1 ? proportional + COVERED_HOUR_BONUS : proportional
          const c = model.newBoolVar(`cov_${d}_${h}_${k}`)
          covered.push(c)
          objVars.push(c)
          objCoeffs.push(-gain)
        }
        model.add(LinearExpr.from(LinearExpr.sum(covered)).le(staffed))
        continue
      }
      const required = demand[d][h]
      if (required > 0) {
        const shortfall = model.newIntVar(0, required, `short_${d}_${h}`)
        model.add(staffed.plus(shortfall).ge(required))
        objVars.push(shortfall)
        objCoeffs.push(SHORTFALL_WEIGHT)
      }
      const surplus = model.newIntVar(0, terms.length, `surplus_${d}_${h}`)
      model.add(staffed.minus(surplus).le(required))
      objVars.push(surplus)
      objCoeffs.push(SURPLUS_WEIGHT)
    }
  }

  // Soft: fairness = spread of utilization across employees.
  const maxUtil = model.newIntVar(0, 1000, "max_util")
  const minUtil = model.newIntVar(0, 1000, "min_util")
  for (const u of util) {
    model.add(maxUtil.minus(u).ge(0))
    model.add(minUtil.minus(u).le(0))
  }
  objVars.push(maxUtil, minUtil)
  const spreadWeight = explicit ? SPREAD_WEIGHT : FAIRNESS_WEIGHT
  objCoeffs.push(spreadWeight, -spreadWeight)

  // Soft: overtime, minimized in total and spread across employees.
  const overtimeWeight =
    (explicit ? TARGET_OVERTIME_WEIGHT_PER_HOUR : OVERTIME_WEIGHT_PER_HOUR) / 60
  const maxOver = model.newIntVar(0, 7 * 24 * 60, "max_over")
  for (const over of overs) {
    objVars.push(over)
    objCoeffs.push(overtimeWeight)
    model.add(maxOver.minus(over).ge(0))
  }
  objVars.push(maxOver)
  objCoeffs.push(OVERTIME_SPREAD_WEIGHT)

  model.minimize(weightedSum(objVars, objCoeffs))

  const seconds = options.maxSolveSeconds ?? DEFAULT_MAX_SOLVE_SECONDS
  const solved = await CpSat.solve(model, {
    executor: options.executor ?? "worker",
    numWorkers: 1,
    randomSeed: RANDOM_SEED,
    maxDeterministicTime: seconds,
    maxTimeInSeconds: seconds * 3,
    signal: options.signal,
  })
  // The result's `status` may be a name or a number; statusName() is always the name.
  const statusName = solved.statusName()
  if (
    !solved.hasSolution ||
    (statusName !== "OPTIMAL" && statusName !== "FEASIBLE")
  ) {
    throw new Error(
      `Auto-scheduling did not find a valid roster (solver status: ${statusName}).`
    )
  }

  const assignments: AssignmentCandidate[] = []
  people.forEach((person, p) => {
    for (const d of days) {
      shifts.forEach((s, i) => {
        if (solved.value(x[p][d][i]) === 1n) {
          assignments.push({ staffId: person.id, shiftId: s.id, dayOfWeek: d })
        }
      })
    }
  })

  // Metrics are recomputed from the decoded roster, independent of the solver's variables.
  const shiftById = new Map(shifts.map((s) => [s.id, s]))
  const staffed = days.map(() => new Array<number>(24).fill(0))
  for (const a of assignments) {
    for (const h of touched.get(shiftById.get(a.shiftId)!.id)!) {
      staffed[a.dayOfWeek][h] += 1
    }
  }
  const shortfalls: Shortfall[] = []
  const unstaffedHours: UnstaffedHour[] = []
  let surplusStaffHours = 0
  for (const d of days) {
    for (let h = 0; h < 24; h++) {
      if (txGrid[d][h] > 0 && staffed[d][h] === 0) {
        unstaffedHours.push({
          dayOfWeek: d,
          hour: h,
          transactions: txGrid[d][h],
        })
      }
      if (!explicit) continue
      const required = demand[d][h]
      if (staffed[d][h] < required) {
        shortfalls.push({
          dayOfWeek: d,
          hour: h,
          required,
          staffed: staffed[d][h],
        })
      } else {
        surplusStaffHours += staffed[d][h] - required
      }
    }
  }
  const hoursByStaff: Record<string, number> = Object.fromEntries(
    input.staff.map((s) => [s.id, 0])
  )
  for (const a of assignments) {
    hoursByStaff[a.staffId] += shiftDurationHours(shiftById.get(a.shiftId)!)
  }
  const overMaxStaff: OverMaxStaff[] = people
    .filter((p) => hoursByStaff[p.id] > p.maxWeeklyHours)
    .map((p) => ({
      staffId: p.id,
      hours: hoursByStaff[p.id],
      maxWeeklyHours: p.maxWeeklyHours,
      overHours: hoursByStaff[p.id] - p.maxWeeklyHours,
    }))
  const notes: string[] = []
  if (overMaxStaff.length > 0) {
    notes.push(
      `${overMaxStaff.length} employee${overMaxStaff.length === 1 ? " was" : "s were"} scheduled over their maximum weekly hours to cover hours with transactions.`
    )
  }
  if (unstaffedHours.length > 0) {
    notes.push("No shift template covers some hours with transactions.")
  }
  if (statusName === "FEASIBLE") {
    notes.push(
      "Time limit reached; this is a good roster but not proven optimal."
    )
  }

  return {
    assignments,
    status: statusName === "OPTIMAL" ? "optimal" : "feasible",
    unstaffedHours,
    shortfalls,
    surplusStaffHours,
    hoursByStaff,
    overMaxStaff,
    notes,
  }
}

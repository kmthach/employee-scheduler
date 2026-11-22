import type { AssignmentCandidate } from "./assignment"
import { staffedHours } from "./coverage"
import { buildDemandGrid } from "./demand"
import { shiftDurationHours, timesOverlap } from "./time"
import type { DayOfWeek, Shift, Staff, TransactionRecord } from "./types"

/**
 * Auto-scheduler: models the week as a constraint problem and solves it with OR-Tools CP-SAT.
 * See algorithm.md for the full description. Pure domain code: no React or Zustand.
 */

/** Objective weights: covering demand ≫ not overstaffing ≫ fairness (utilization spread, ‰). */
export const SHORTFALL_WEIGHT = 10_000
export const SURPLUS_WEIGHT = 300
export const SPREAD_WEIGHT = 1

const DEFAULT_MAX_SOLVE_SECONDS = 5
const RANDOM_SEED = 1

export interface AutoScheduleInput {
  staff: Staff[]
  shifts: Shift[]
  transactions: TransactionRecord[]
}

export interface AutoScheduleOptions {
  /** Demand rule: required staff = ceil(transactions / this). Default 15. */
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

export interface AutoScheduleResult {
  /** IDs and scheduleId are added by the caller. */
  assignments: AssignmentCandidate[]
  /** "optimal" = proven best; "feasible" = time limit hit, best found (still valid). */
  status: "optimal" | "feasible"
  /** Hours that remain understaffed, e.g. when capacity is insufficient. */
  shortfalls: Shortfall[]
  /** Staff-hours above the required level (across every hour a shift touches). */
  surplusStaffHours: number
  hoursByStaff: Record<string, number>
  notes: string[]
}

function emptyResult(staff: Staff[], notes: string[]): AutoScheduleResult {
  return {
    assignments: [],
    status: "optimal",
    shortfalls: [],
    surplusStaffHours: 0,
    hoursByStaff: Object.fromEntries(staff.map((s) => [s.id, 0])),
    notes,
  }
}

export async function generateSchedule(
  input: AutoScheduleInput,
  options: AutoScheduleOptions = {}
): Promise<AutoScheduleResult> {
  const demand = buildDemandGrid(
    input.transactions,
    options.transactionsPerStaffHour
  )
  const people = input.staff.filter((s) => s.maxWeeklyHours > 0)
  const shifts = input.shifts.filter((s) => shiftDurationHours(s) > 0)

  if (!demand.some((day) => day.some((n) => n > 0))) {
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

  // Hard: maximum weekly hours (generator only; manual edits may exceed it with a warning).
  const util = [] as ReturnType<typeof model.newIntVar>[]
  const weeklyMinutes: InstanceType<typeof LinearExpr>[] = []
  people.forEach((person, p) => {
    const minuteTerms = days.flatMap((d) =>
      shifts.map((s, i) => x[p][d][i].times(minutesOf(s)))
    )
    const minutes = LinearExpr.from(LinearExpr.sum(minuteTerms))
    weeklyMinutes.push(minutes)
    const maxMinutes = Math.round(person.maxWeeklyHours * 60)
    model.add(minutes.le(maxMinutes))
    // Fairness: utilization in permille of this employee's own maximum.
    const u = model.newIntVar(0, 1000, `util_${person.id}`)
    model.addDivisionEquality(u, minutes.times(1000), maxMinutes)
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

  // Soft: coverage per (day, hour).
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
      const required = demand[d][h]
      const staffed = LinearExpr.from(LinearExpr.sum(terms))
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
  objCoeffs.push(SPREAD_WEIGHT, -SPREAD_WEIGHT)

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
  let surplusStaffHours = 0
  for (const d of days) {
    for (let h = 0; h < 24; h++) {
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
  const notes: string[] = []
  if (shortfalls.length > 0) {
    notes.push("Not enough employee capacity to cover all demand.")
  }
  if (statusName === "FEASIBLE") {
    notes.push(
      "Time limit reached; this is a good roster but not proven optimal."
    )
  }

  return {
    assignments,
    status: statusName === "OPTIMAL" ? "optimal" : "feasible",
    shortfalls,
    surplusStaffHours,
    hoursByStaff,
    notes,
  }
}

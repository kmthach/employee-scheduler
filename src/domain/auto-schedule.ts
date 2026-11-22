import type { AssignmentCandidate } from "./assignment"
import { staffedHours } from "./coverage"
import { buildRequiredGrid, buildTransactionGrid } from "./demand"
import { shiftDurationHours, timesOverlap } from "./time"
import type { DayOfWeek, Shift, Staff, TransactionRecord } from "./types"

/**
 * Auto-scheduler: models the week as a constraint problem and solves it with OR-Tools CP-SAT,
 * one goal at a time in strict priority order (see algorithm.md). Employees never exceed their
 * maximum weekly hours. Pure domain code: no React or Zustand.
 */

const DEFAULT_MAX_SOLVE_SECONDS = 5
const RANDOM_SEED = 1
const MINUTES_PER_WEEK = 7 * 24 * 60

/**
 * Solver stages, in strict priority order: 1. understaffing, 2. total assigned hours (so
 * fairness never adds work nobody needs), 3. fairness.
 */
type Stage = "understaffing" | "workload" | "fairness"
const STAGES: Stage[] = ["understaffing", "workload", "fairness"]

/** Share of the solve time budget for each stage. */
const STAGE_TIME_SHARE = [0.5, 0.25, 0.25]

export interface AutoScheduleInput {
  staff: Staff[]
  shifts: Shift[]
  transactions: TransactionRecord[]
}

export interface AutoScheduleOptions {
  /** "worker" keeps the UI responsive (default); "direct" blocks but is simpler in tests. */
  executor?: "worker" | "direct"
  /** Solve time budget, split across the stages. Also the deterministic time limit. */
  maxSolveSeconds?: number
  signal?: AbortSignal
}

export interface Shortfall {
  dayOfWeek: DayOfWeek
  hour: number
  /** Staff the hour needs at 15 transactions per staff hour. */
  required: number
  staffed: number
}

export interface UnstaffedHour {
  dayOfWeek: DayOfWeek
  hour: number
  transactions: number
}

/** Everything measured about a roster, recomputed from assignments (never read from the solver). */
export interface RosterMetrics {
  /** Hours below the required staffing. */
  shortfalls: Shortfall[]
  /** Total missing person-hours: the understaffing objective. */
  understaffing: number
  /** Hours with transactions but nobody staffed (same marker as Coverage "No staff"). */
  unstaffedHours: UnstaffedHour[]
  /** Total assigned minutes: the "no needless hours" step solved just before fairness. */
  assignedMinutes: number
  /** max − min utilization (assigned ÷ maximum hours, in permille): the fairness objective. */
  fairnessSpread: number
  hoursByStaff: Record<string, number>
}

export interface AutoScheduleResult extends RosterMetrics {
  /** IDs and scheduleId are added by the caller. */
  assignments: AssignmentCandidate[]
  /** "optimal" = every stage proven best; "feasible" = a time limit was hit, still valid. */
  status: "optimal" | "feasible"
  understaffedStaffHours: number
  notes: string[]
}

const minutesOf = (s: Shift) => Math.round(shiftDurationHours(s) * 60)

/** Employees the generator can use: those with a positive maximum. */
const eligibleStaff = (staff: Staff[]) =>
  staff.filter((s) => s.maxWeeklyHours > 0)

/** Staff required per (day, hour): 15 transactions per staff hour (see `demand.ts`). */
const requiredGrid = (input: AutoScheduleInput) =>
  buildRequiredGrid(buildTransactionGrid(input.transactions))

/**
 * Measures a roster: understaffing, total hours and fairness exactly as the solver defines them.
 * Employees with a maximum of 0 are never counted in fairness (no division by zero).
 */
export function evaluateRoster(
  input: AutoScheduleInput,
  assignments: AssignmentCandidate[]
): RosterMetrics {
  const shiftById = new Map(input.shifts.map((s) => [s.id, s]))
  const txGrid = buildTransactionGrid(input.transactions)
  const required = requiredGrid(input)

  const working = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => new Set<string>())
  )
  const minutes = new Map<string, number>(input.staff.map((s) => [s.id, 0]))
  for (const a of assignments) {
    const shift = shiftById.get(a.shiftId)
    if (!shift) continue
    minutes.set(a.staffId, (minutes.get(a.staffId) ?? 0) + minutesOf(shift))
    for (const h of staffedHours(shift)) working[a.dayOfWeek][h].add(a.staffId)
  }

  const shortfalls: Shortfall[] = []
  const unstaffedHours: UnstaffedHour[] = []
  let understaffing = 0
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const staffed = working[d][h].size
      if (txGrid[d][h] > 0 && staffed === 0) {
        unstaffedHours.push({
          dayOfWeek: d as DayOfWeek,
          hour: h,
          transactions: txGrid[d][h],
        })
      }
      if (staffed < required[d][h]) {
        understaffing += required[d][h] - staffed
        shortfalls.push({
          dayOfWeek: d as DayOfWeek,
          hour: h,
          required: required[d][h],
          staffed,
        })
      }
    }
  }

  const hoursByStaff: Record<string, number> = {}
  const utilizations: number[] = []
  let assignedMinutes = 0
  for (const person of input.staff) {
    const m = minutes.get(person.id) ?? 0
    assignedMinutes += m
    hoursByStaff[person.id] = m / 60
    if (!(person.maxWeeklyHours > 0)) continue
    const maxMinutes = Math.round(person.maxWeeklyHours * 60)
    utilizations.push(Math.floor((1000 * m) / maxMinutes))
  }
  const fairnessSpread =
    utilizations.length > 0
      ? Math.max(...utilizations) - Math.min(...utilizations)
      : 0

  return {
    shortfalls,
    understaffing,
    unstaffedHours,
    assignedMinutes,
    fairnessSpread,
    hoursByStaff,
  }
}

/** Result for inputs with nothing to schedule: no assignments and nothing required. */
function emptyResult(
  input: AutoScheduleInput,
  notes: string[]
): AutoScheduleResult {
  return {
    ...evaluateRoster(input, []),
    shortfalls: [],
    understaffing: 0,
    unstaffedHours: [],
    assignments: [],
    status: "optimal",
    understaffedStaffHours: 0,
    notes,
  }
}

export async function generateSchedule(
  input: AutoScheduleInput,
  options: AutoScheduleOptions = {}
): Promise<AutoScheduleResult> {
  const totalTx = buildTransactionGrid(input.transactions)
    .flat()
    .reduce((n, v) => n + v, 0)
  const people = eligibleStaff(input.staff)
  const shifts = input.shifts.filter((s) => shiftDurationHours(s) > 0)

  if (totalTx <= 0) {
    return emptyResult(input, ["No transaction demand to schedule for."])
  }
  if (people.length === 0) {
    return emptyResult(input, [
      "No employees with maximum weekly hours above 0.",
    ])
  }
  if (shifts.length === 0) {
    return emptyResult(input, ["No valid shift templates."])
  }

  const required = requiredGrid(input)

  // Loaded lazily: keeps the WASM runtime out of the main bundle and out of trivial runs.
  const { CpModel, CpSat, LinearExpr } = await import("cp-sat-wasm")

  const days = [0, 1, 2, 3, 4, 5, 6] as const
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

  // Per employee: weekly minutes (hard maximum) and utilization (fairness).
  const weeklyMinutes: InstanceType<typeof LinearExpr>[] = []
  const utils = [] as ReturnType<typeof model.newIntVar>[]
  let maxUtilBound = 0
  people.forEach((person, p) => {
    const minuteTerms = days.flatMap((d) =>
      shifts.map((s, i) => x[p][d][i].times(minutesOf(s)))
    )
    const minutes = LinearExpr.from(LinearExpr.sum(minuteTerms))
    weeklyMinutes.push(minutes)
    const maxMinutes = Math.round(person.maxWeeklyHours * 60)
    // Hard: never above the employee's maximum weekly hours (exactly at the maximum is fine).
    model.add(minutes.le(maxMinutes))
    // Utilization of the employee's own maximum, in permille (at most 1000 because of the cap).
    const utilBound = Math.min(
      1000,
      Math.ceil((MINUTES_PER_WEEK * 1000) / maxMinutes)
    )
    maxUtilBound = Math.max(maxUtilBound, utilBound)
    const util = model.newIntVar(0, utilBound, `util_${person.id}`)
    model.addDivisionEquality(util, minutes.times(1000), maxMinutes)
    utils.push(util)
  })

  // Symmetry breaking: employees with the same maximum are interchangeable, so order their
  // weekly minutes. All goals treat them alike, so this never changes an optimum.
  const lastWithMax = new Map<number, number>()
  people.forEach((person, p) => {
    const prev = lastWithMax.get(person.maxWeeklyHours)
    if (prev !== undefined) model.add(weeklyMinutes[prev].ge(weeklyMinutes[p]))
    lastWithMax.set(person.maxWeeklyHours, p)
  })

  // Understaffing: person-hours missing against the required staffing.
  const shortfallVars = [] as ReturnType<typeof model.newIntVar>[]
  for (const d of days) {
    for (let h = 0; h < 24; h++) {
      if (required[d][h] <= 0) continue
      const terms = []
      for (let p = 0; p < people.length; p++) {
        for (let i = 0; i < shifts.length; i++) {
          if (touched.get(shifts[i].id)!.includes(h)) terms.push(x[p][d][i])
        }
      }
      if (terms.length === 0) continue // no template reaches this hour: cannot be helped
      const shortfall = model.newIntVar(0, required[d][h], `short_${d}_${h}`)
      model.add(
        LinearExpr.from(LinearExpr.sum(terms))
          .plus(shortfall)
          .ge(required[d][h])
      )
      shortfallVars.push(shortfall)
    }
  }

  // Fairness: spread of utilization.
  const maxUtil = model.newIntVar(0, maxUtilBound, "max_util")
  const minUtil = model.newIntVar(0, maxUtilBound, "min_util")
  for (const util of utils) {
    model.add(maxUtil.minus(util).ge(0))
    model.add(minUtil.minus(util).le(0))
  }

  const objectives: Record<Stage, InstanceType<typeof LinearExpr>> = {
    understaffing:
      shortfallVars.length > 0
        ? LinearExpr.from(LinearExpr.sum(shortfallVars))
        : LinearExpr.from(model.newIntVar(0, 0, "zero")),
    workload: LinearExpr.from(LinearExpr.sum(weeklyMinutes)),
    fairness: LinearExpr.from(maxUtil.minus(minUtil)),
  }

  // Lexicographic optimization: optimize one goal, keep its result as a constraint, then
  // optimize the next. A stage cut short by the time limit still keeps the value it found.
  const totalSeconds = options.maxSolveSeconds ?? DEFAULT_MAX_SOLVE_SECONDS
  let solved: Awaited<ReturnType<typeof CpSat.solve>> | undefined
  let allOptimal = true
  for (let stage = 0; stage < STAGES.length; stage++) {
    model.clearObjective()
    model.minimize(objectives[STAGES[stage]])
    const seconds = totalSeconds * STAGE_TIME_SHARE[stage]
    solved = await CpSat.solve(model, {
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
    if (statusName !== "OPTIMAL") allOptimal = false
    if (stage < STAGES.length - 1) {
      const value = solved.objectiveValue
      if (value === null) {
        throw new Error("Auto-scheduling lost an objective value.")
      }
      model.add(objectives[STAGES[stage]].le(Math.round(value)))
      // Warm start: the last solution already satisfies the new constraint.
      model.clearHints()
      for (let p = 0; p < people.length; p++) {
        for (const d of days) {
          shifts.forEach((_, i) =>
            model.addHint(x[p][d][i], solved!.value(x[p][d][i]) === 1n)
          )
        }
      }
    }
  }
  const final = solved!

  const assignments: AssignmentCandidate[] = []
  people.forEach((person, p) => {
    for (const d of days) {
      shifts.forEach((s, i) => {
        if (final.value(x[p][d][i]) === 1n) {
          assignments.push({ staffId: person.id, shiftId: s.id, dayOfWeek: d })
        }
      })
    }
  })

  const metrics = evaluateRoster(input, assignments)
  const understaffedStaffHours = metrics.understaffing
  const notes: string[] = []
  if (understaffedStaffHours > 0) {
    const s = understaffedStaffHours === 1 ? "" : "s"
    notes.push(
      `Employees' maximum weekly hours were reached, so ${understaffedStaffHours} staff-hour${s} could not be staffed.`
    )
  }
  if (!allOptimal) {
    notes.push(
      "Time limit reached; this is a good roster but not proven optimal."
    )
  }

  return {
    ...metrics,
    assignments,
    status: allOptimal ? "optimal" : "feasible",
    understaffedStaffHours,
    notes,
  }
}

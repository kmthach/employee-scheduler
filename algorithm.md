# Auto-Scheduling Algorithm

Design of the Phase 7 auto-scheduler. It generates an **editable draft** roster for one schedule (Monday–Sunday) from the schedule's staff, shift templates and transaction data.

> Status: implemented in Phase 7, then revised to remove the hardcoded 15 transactions-per-staff-hour target. The code lives in `src/domain/demand.ts` and `src/domain/auto-schedule.ts` (`generateSchedule`). Phase 8 wires it into the UI.

## 1. Approach in one paragraph

Scheduling is modelled as a small **constraint optimization problem** and solved with Google OR-Tools **CP-SAT** (`cp-sat-wasm`, WebAssembly, runs locally in the browser or Node). We decide, for every employee, day and shift template, whether that employee works it (a yes/no variable). Hard rules (no overlaps, maximum weekly hours) are constraints that can never be broken. Everything we merely *prefer* (put more people on busier hours, keep idle hours empty, spread hours fairly) is a weighted objective the solver optimises. **No productivity target is assumed**: transaction counts are only relative demand weights. The solver returns the assignment set with the lowest total penalty. A feasible answer always exists (an empty roster), so the solver never fails; when capacity is insufficient the result simply reports the hours that have transactions but no staff.

## 2. Inputs and outputs

Pure domain function, no React or Zustand:

```ts
generateSchedule(input, options): Promise<AutoScheduleResult>
```

| Input | Source | Used for |
| --- | --- | --- |
| `staff[]` | `Staff` (`id`, `maxWeeklyHours`) | Who can work, and each person's hour cap |
| `shifts[]` | `Shift` (`startTime`, `endTime`) | Available templates; may overlap each other |
| `transactions[]` | `TransactionRecord` (`dayOfWeek`, `hour`, `transactionCount`) | Demand per day and clock hour |
| `options.transactionsPerStaffHour` | **none by default** | Optional explicit target; only used if a caller sets it |
| `options.executor`, `maxSolveSeconds`, `signal` | | Where/how long to solve, cancellation |

Output (`AutoScheduleResult`):

- `assignments`: `{ staffId, shiftId, dayOfWeek }[]`. IDs and `scheduleId` are added by the caller (Phase 8), the same way manual assignments get them.
- `status`: `optimal` (proven best) or `feasible` (time limit hit; best found, still valid).
- `unstaffedHours`: `{ dayOfWeek, hour, transactions }[]` for hours with transactions but nobody staffed (same marker as Coverage "No staff").
- `shortfalls` and `surplusStaffHours`: populated only in explicit-target mode (otherwise empty / 0).
- `hoursByStaff` and `notes` (e.g. "No transaction data").

Existing assignments are **ignored**: the generator always builds a roster from scratch. How regeneration treats manual edits is a Phase 8 UX decision.

## 3. Step 1 — Demand as a relative signal

The assignment gives transaction counts but **no productivity target**, so the scheduler does not convert them into a required headcount. Counts are used only to compare hours with each other:

```
share(day, hour) = transactions(day, hour) / total transactions in the week
```

Missing cells count as 0. Only shares matter, so doubling every count produces the same roster (tested).

**Assumptions (and nothing else):**

1. More transactions in an hour means more need for staff in that hour.
2. Each extra person in the same hour helps less than the one before (diminishing returns), so the schedule does not pile everyone onto the single busiest hour.
3. Each employee's maximum weekly hours is the capacity budget (hard cap).
4. An hour with no transactions has no demand value.

**Objective model.** The k-th employee staffed in an hour earns a gain `DEMAND_SCALE · share / k`. These harmonic gains are the discrete form of maximising `Σ share · ln(staffed)`: when capacity is scarce, the optimum allocates staff in proportion to demand. This is a proportional allocation, not a ratio target, and it contains no cutoff such as "enough staff at N transactions".

**Deliberately omitted:** a labor-cost or overstaffing penalty. Any such per-hour cost would stop adding staff when `share / k` drops below it, i.e. at `k ≈ transactions / cost`, which is a hidden transactions-per-staff-hour target. Capacity is therefore the only limit.

**Consequence:** when capacity exceeds what is needed, employees end near the same percentage of their maximum hours, with the extra people stacked on the busiest hours. If a manager wants fewer hours, they lower maximum hours or edit the draft.

**Evaluation only:** transactions per staff hour is reported by the Coverage view (`coverage.ts`) as a metric for the generated roster. It never drives the algorithm.

**Optional explicit target.** A caller may pass `options.transactionsPerStaffHour`. Only then is `required = ceil(transactions / target)` computed and the older shortfall/surplus objective used (`shortfalls`, `surplusStaffHours` are populated). Nothing sets this by default.

## 4. Step 2 — Decision variables

For every employee *e* (with `maxWeeklyHours > 0`), day *d* (0–6) and valid shift *s*:

```
x[e][d][s] ∈ {0, 1}      1 = employee e works shift s on day d
```

Shifts with invalid times or zero length are skipped. Duration is kept in **minutes** so odd lengths (e.g. 07:30–15:15) are exact.

Helper quantities (linear expressions, not extra decisions):

- `minutes[e] = Σ x[e][d][s] · duration(s)` — weekly minutes for *e*.
- `staffed[d][h] = Σ x[e][d][s]` over all *e* and every shift *s* that touches clock hour *h*. A shift touches hour *h* if it starts before *h+1* and ends after *h*, the same definition as `staffedHours()` in `coverage.ts`, so generated rosters are measured exactly like the Coverage view.

## 5. Step 3 — Hard constraints (never violated)

1. **No overlapping assignments.** For each employee and day, any two shift templates that overlap (`timesOverlap()` in `time.ts`; touching boundaries such as 12:00/12:00 do *not* overlap) can have at most one chosen: `x[e][d][a] + x[e][d][b] ≤ 1`. This is the same rule manual assignment uses, so the output can always be published. Two different templates may overlap each other; one *employee* just can't work both.
2. **No duplicates.** One variable per (employee, day, shift) makes a duplicate impossible.
3. **Maximum weekly hours.** `minutes[e] ≤ maxWeeklyHours[e] · 60`.

> Maximum hours are a *warning* for manual edits (a manager may knowingly exceed them). The generator is stricter on purpose: an auto-draft that already breaks limits would be a poor starting point, and the roadmap requires the algorithm to respect them. Manual edits afterwards can still exceed the cap and show a warning.

## 6. Step 4 — Soft goals (the objective)

CP-SAT optimises one weighted objective (default mode).

**a) Demand (maximise).** For every (day, hour) with transactions, boolean `covered[k]` (k = 1..number of employees) with `Σ covered[k] ≤ staffed(day, hour)`, each worth `DEMAND_SCALE · share / k`. Decreasing gains mean the solver always fills lower k first. Busier hours earn larger gains, so they attract more people.

**b) Idle hours (minimise).** A tiny penalty (`IDLE_WEIGHT`) per staffed employee-hour with zero transactions, so nobody is scheduled into hours with no demand unless a shift template forces it.

**c) Fairness (utilization spread).** Measured against each person's *own* capacity, so a 20 h part-timer and a 40 h full-timer are treated proportionally:

```
util[e]  = floor(1000 · minutes[e] / (maxWeeklyHours[e] · 60))     (permille, via integer division)
spread   = max(util[e]) − min(util[e])
```

```
maximise  Σ demand gains  −  IDLE_WEIGHT · idle staff-hours  −  FAIRNESS_WEIGHT · spread
```

`FAIRNESS_WEIGHT` (default 100) is a tuning constant: it trades coverage against evenness relative to the normalised demand gains. It is not a productivity threshold. The constants are named in `auto-schedule.ts` and the tests pin the intended behaviour.

**Explicit-target mode** keeps the old objective: `10000 · Σ shortfall + 300 · Σ surplus + 1 · spread`, minimised.

## 7. Step 5 — Solve and decode

- Solver: `CpSat.solve(model, { executor, numWorkers: 1, randomSeed: 1, maxDeterministicTime, maxTimeInSeconds })`.
- **Deterministic:** one worker, fixed seed and a machine-independent deterministic time limit give the same roster for the same input (verified in the spike: three identical runs). A wall-clock `maxTimeInSeconds` is only a safety net.
- Status handling: `OPTIMAL` → `optimal`; `FEASIBLE` (limit hit) → `feasible`; otherwise an error is raised (should not occur, since the empty roster is always feasible).
- Variable values come back as `bigint`; an assignment exists when `value === 1n`.
- Metrics (`unstaffedHours`, `hoursByStaff`, and in target mode `shortfalls`, `surplusStaffHours`) are **recomputed in plain TypeScript from the decoded assignments**, not read from solver variables, so the report is independent of the model and matches the Coverage view.
- Symmetry breaking: employees with the same maximum are interchangeable, so their weekly minutes are ordered (`minutes[i] ≥ minutes[i+1]`). This removes equivalent solutions and speeds up proving optimality; it does not change the best objective value.
- Time limit defaults to 5 s (deterministic); large, highly symmetric inputs may return `feasible` rather than `optimal`.
- Browser: run with `executor: 'worker'` so the UI stays responsive; `signal` (AbortSignal) allows cancelling.

## 8. Edge cases

| Situation | Behaviour |
| --- | --- |
| No transaction data / all counts zero | Empty assignments, note "No demand data"; solver is not even loaded |
| No staff or no valid shifts | Empty assignments, note explaining why |
| Employee with `maxWeeklyHours = 0` | Never assigned; excluded from fairness |
| Not enough capacity | Valid roster within caps; hours with transactions but no staff listed in `unstaffedHours` |
| Day with no demand | No assignments that day |
| Overlapping shift templates | Allowed to coexist; one employee never gets two overlapping ones |
| Overnight shifts | Out of scope (end must be after start), as elsewhere in the app |

## 9. Worked mini-example

Two employees, A (max 8 h) and B (max 4 h); templates S1 09:00–13:00 and S2 11:00–15:00 (overlapping). Monday transactions: 09:00 → 10, 11:00 → 30, 12:00 → 30, 14:00 → 10.

- A cannot take both templates (overlap) and B's cap is one 4 h shift.
- A → S1 and B → S2 puts both on the 11:00 and 12:00 hours (the busiest), one person on 09:00, 10:00 and 14:00. The 13:00 hour has no transactions and one person (idle penalty, unavoidable here).
- No headcount target was needed: the busiest hours simply received the most staff. A at 4/8 and B at 4/4 gives a utilization spread of 500‰, the fairness term then competes with demand gains for any alternative.

## 10. Performance

Model size is `staff × 7 × shifts` booleans plus about 168 coverage constraints. Measured in the spike (Node, one worker): 5 staff / 4 shifts ≈ 50–220 ms; 15 staff / 6 overlapping shifts ≈ 0.4 s; all scenarios solved to optimality. Browser Chromium cold start ≈ 130–170 ms plus a one-time download of the WASM runtime (≈ 2.7 MB gzip).

## 11. Why CP-SAT rather than a greedy heuristic

A greedy approach (fill the biggest gap, give it to the least-utilised employee) is simpler but handles overlapping templates, per-person caps and the coverage/fairness trade-off poorly and gives no optimality guarantee. CP-SAT states the rules declaratively, finds provably good solutions at this problem size and reports whether it is optimal. Trade-offs: a ≈ 21 MB dependency (≈ 2.7 MB over the wire in Chromium), browser cross-origin-isolation headers (COOP/COEP) required for local solving (Phase 8 work), and a library banner printed on first solve.

## 12. Known limitations / possible later work

- No minimum staffing (e.g. always ≥ 2 at opening) and no manager-set productivity target in the UI; an optional target exists only as a domain option.
- No employee availability, skills, breaks, minimum shift counts or preferred days.
- Fairness considers weekly hours only, not distribution of busy/unpopular shifts.
- Regeneration ignores existing assignments (Phase 8 decides how to preserve manual work).

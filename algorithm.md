# Auto-Scheduling Algorithm

Design of the Phase 7 auto-scheduler. It generates an **editable draft** roster for one schedule (Monday–Sunday) from the schedule's staff, shift templates and transaction data.

> Status: implemented in Phase 7, then revised: fixed 15 transactions-per-staff-hour staffing target, and **maximum weekly hours are a hard limit** (no overtime). Code: `src/domain/demand.ts`, `src/domain/auto-schedule.ts` (`generateSchedule`, `evaluateRoster`).

## 1. Approach in one paragraph

Scheduling is a small **constraint optimization problem** solved with Google OR-Tools **CP-SAT** (`cp-sat-wasm`, WebAssembly). For every employee, day and shift template there is a yes/no variable. Two rules are hard and never broken: **no overlapping assignments** and **no employee above their maximum weekly hours** (no overtime). The solver then optimizes **one goal at a time in strict priority order** (section 6): minimize understaffing, then avoid needless hours, then fairness. A feasible answer always exists (the empty roster), so the solver does not fail; when capacity is short, the remaining shortfall is reported as understaffing rather than bought with overtime.

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
| `options.executor`, `maxSolveSeconds`, `signal` | | Where/how long to solve, cancellation |

Output (`AutoScheduleResult`):

- `assignments`: `{ staffId, shiftId, dayOfWeek }[]`. IDs and `scheduleId` are added by the caller (Phase 8), the same way manual assignments get them.
- `status`: `optimal` (proven best) or `feasible` (time limit hit; best found, still valid).
- `unstaffedHours`: `{ dayOfWeek, hour, transactions }[]` for hours with transactions but nobody staffed (same marker as Coverage "No staff").
- `understaffedStaffHours`, `fairnessSpread`, `assignedMinutes`.
- `shortfalls`: `{ dayOfWeek, hour, required, staffed }[]` for hours below the required staffing.
- `hoursByStaff` and `notes` (e.g. "No transaction data").

Existing assignments are **ignored**: the generator always builds a roster from scratch. The UI asks before replacing them and offers Undo (Phase 8).

## 3. Step 1 — Demand and required staffing

Transaction counts are turned into a required headcount with one explicit assumption, **15 transactions per staff hour** (`TRANSACTIONS_PER_STAFF_HOUR` in `demand.ts`):

```
required(day, hour) = transactions > 0 ? max(1, ceil(transactions / 15)) : 0
```

| Transactions in the hour | 0 | 5 | 15 | 16 | 30 | 45 | 60 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Required staff | 0 | 1 | 1 | 2 | 2 | 3 | 4 |

**Why 15:** it means one transaction every 4 minutes per employee, which leaves time for work that is not a transaction (restocking, cleaning, prep, breaks) in retail and food service. It is an assumption, **not derived from the data**, and the value is illustrative. It is a single constant, fixed in code: managers do not enter it. Hours without transactions need nobody (there is no opening-hours data), and requirements do not depend on team size or on the week's total volume.

The same metric is also shown in the Coverage view as an *evaluation* of the generated roster (`coverage.ts`).

## 4. Step 2 — Decision variables

For every employee *e* (with `maxWeeklyHours > 0`), day *d* (0–6) and valid shift *s*:

```
x[e][d][s] ∈ {0, 1}      1 = employee e works shift s on day d
```

Shifts with invalid times or zero length are skipped. Duration is kept in **minutes** so odd lengths (e.g. 07:30–15:15) are exact.

Helper quantities (linear expressions, not extra decisions; employees with a maximum of 0 are excluded entirely):

- `minutes[e] = Σ x[e][d][s] · duration(s)` — weekly minutes for *e*.
- `staffed[d][h] = Σ x[e][d][s]` over all *e* and every shift *s* that touches clock hour *h*. A shift touches hour *h* if it starts before *h+1* and ends after *h*, the same definition as `staffedHours()` in `coverage.ts`, so generated rosters are measured exactly like the Coverage view.

## 5. Step 3 — Hard constraints (never violated)

1. **No overlapping assignments.** For each employee and day, any two shift templates that overlap (`timesOverlap()` in `time.ts`; touching boundaries such as 12:00/12:00 do *not* overlap) can have at most one chosen: `x[e][d][a] + x[e][d][b] ≤ 1`. This is the same rule manual assignment uses, so the output can always be published. Two different templates may overlap each other; one *employee* just can't work both.
2. **No duplicates.** One variable per (employee, day, shift) makes a duplicate impossible.

3. **Maximum weekly hours.** `minutes[e] ≤ round(maxWeeklyHours[e] · 60)` for every employee, so nobody is ever scheduled into overtime; exactly the maximum is allowed. Employees with a maximum of 0 are never scheduled. The same rule blocks manual assignments (`checkAssignment`, reason `over-max`), and a draft that is over the maximum after a shift-template or maximum-hours edit cannot be published.

## 6. Step 4 — Goals, optimized in strict order (lexicographic)

All values are integers.

- **Understaffing** `U = Σ max(0, required − staffed)` over every hour (each period is one hour, so this is also staff-hours of understaffing), in whole person-hours (shortfall variables `shortfall ≥ required − staffed`).
- **Total hours** `W = Σ minutes[e]`: a "no needless hours" step.
- **Fairness** `F = max(util) − min(util)` where `util[e] = floor(1000 · minutes[e] / maxMinutes[e])`, the share of each person's *own* maximum in permille (at most 1000 because of the hard cap). A 20 h and a 40 h employee are compared proportionally. Spread is the simplest measure that is linear in the model.

**Stages:** 1. minimize `U`; add `U ≤ best`. 2. minimize `W`; add `W ≤ best`. 3. minimize `F`. A later stage can never worsen an earlier one because earlier optima are constraints, and there are no weights to tune. Step 2 exists because fairness alone would add shifts nobody needs just to even out utilization; with it, fairness only redistributes the hours the first goal requires. Each stage is warm-started from the previous solution.

## 7. Step 5 — Solve and decode

- Solver: one model, solved once per stage with `CpSat.solve(model, { executor, numWorkers: 1, randomSeed: 1, maxDeterministicTime, maxTimeInSeconds })`. The time budget (default 5 s) is split 50 / 25 / 25 % across the three stages. A stage cut short by its limit still enforces the value it found and the result is `feasible`.
- **Deterministic:** one worker, fixed seed and a machine-independent deterministic time limit give the same roster for the same input (verified in the spike: three identical runs). A wall-clock `maxTimeInSeconds` is only a safety net.
- Status handling: `OPTIMAL` → `optimal`; `FEASIBLE` (limit hit) → `feasible`; otherwise an error is raised (should not occur, since the empty roster is always feasible).
- Variable values come back as `bigint`; an assignment exists when `value === 1n`.
- Metrics (`evaluateRoster`: `understaffing`, `assignedMinutes`, `fairnessSpread`, `shortfalls`, `unstaffedHours`, `hoursByStaff`) are **recomputed in plain TypeScript from the decoded assignments**, not read from solver variables, so the report is independent of the model and matches the Coverage view.
- Symmetry breaking: employees with the same maximum are interchangeable, so their weekly minutes are ordered (`minutes[i] ≥ minutes[i+1]`). This removes equivalent solutions and speeds up proving optimality; it does not change the best objective value.
- Time limit defaults to 5 s (deterministic); large, highly symmetric inputs may return `feasible` rather than `optimal`.
- Browser: run with `executor: 'worker'` so the UI stays responsive; `signal` (AbortSignal) allows cancelling.

## 8. Edge cases

| Situation | Behaviour |
| --- | --- |
| No transaction data / all counts zero | Empty assignments, note "No demand data"; solver is not even loaded |
| No staff or no valid shifts | Empty assignments, note explaining why |
| Employee with `maxWeeklyHours = 0` | Never assigned; excluded from fairness |
| Not enough capacity (within maximum hours) | Understaffing is minimized and reported in the banner; no overtime is ever scheduled |
| Hour with transactions that no shift template touches | Cannot be staffed; listed in `unstaffedHours` with a note |
| Day with no demand | No assignments that day |
| Overlapping shift templates | Allowed to coexist; one employee never gets two overlapping ones |
| Overnight shifts | Out of scope (end must be after start), as elsewhere in the app |

## 9. Worked mini-example

One employee (max 8 h), one 12-hour template 08:00–20:00, Monday transactions of 10 per hour in 08–19 (1 person required each hour). Working the template would be 12 h, 4 h over the maximum, so it is not allowed: nobody is assigned and 12 staff-hours are reported understaffed. With a maximum of 12 h the shift is assigned and nothing is understaffed.

## 10. Performance

Model size is `staff × 7 × shifts` booleans plus about 168 coverage constraints. Measured in the spike (Node, one worker): 5 staff / 4 shifts ≈ 50–220 ms; 15 staff / 6 overlapping shifts ≈ 0.4 s; all scenarios solved to optimality. Browser Chromium cold start ≈ 130–170 ms plus a one-time download of the WASM runtime (≈ 2.7 MB gzip).

## 11. Why CP-SAT rather than a greedy heuristic

A greedy approach (fill the biggest gap, give it to the least-utilised employee) is simpler but handles overlapping templates, per-person caps and the coverage/fairness trade-off poorly and gives no optimality guarantee. CP-SAT states the rules declaratively, finds provably good solutions at this problem size and reports whether it is optimal. Trade-offs: a ≈ 21 MB dependency (≈ 2.7 MB over the wire in Chromium), browser cross-origin-isolation headers (COOP/COEP) required for local solving, and a library banner printed on first solve.

## 12. Known limitations / possible later work

- No minimum staffing (e.g. always ≥ 2 at opening) and no manager-set productivity target. The 15 transactions-per-staff-hour value is an assumption (section 3).
- Three sequential solves are slower than one and may return `feasible` (good, not proven optimal) within the time budget.
- No employee availability, skills, breaks, minimum shift counts or preferred days.
- Fairness considers weekly hours only, not distribution of busy/unpopular shifts.
- Small teams show large understaffing: coverage cannot be bought with overtime.
- Regeneration ignores existing assignments. Phase 8 decision: Auto-schedule replaces the week's assignments after an explicit confirmation and offers Undo; no keep-and-fill mode.

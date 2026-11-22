# Auto-Scheduling Algorithm

Design of the Phase 7 auto-scheduler. It generates an **editable draft** roster for one schedule (Monday–Sunday) from the schedule's staff, shift templates and transaction data.

> Status: implemented in Phase 7. The code lives in `src/domain/demand.ts` and `src/domain/auto-schedule.ts` (`generateSchedule`). Phase 8 wires it into the UI.

## 1. Approach in one paragraph

Scheduling is modelled as a small **constraint optimization problem** and solved with Google OR-Tools **CP-SAT** (`cp-sat-wasm`, WebAssembly, runs locally in the browser or Node). We decide, for every employee, day and shift template, whether that employee works it (a yes/no variable). Hard rules (no overlaps, maximum weekly hours) are constraints that can never be broken. Everything we merely *prefer* (cover demand, don't overstaff, spread hours fairly) is a weighted penalty the solver minimises. The solver returns the assignment set with the lowest total penalty. A feasible answer always exists (an empty roster), so the solver never fails; when capacity is insufficient the result simply reports the uncovered hours.

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
| `options.transactionsPerStaffHour` | default `15` | Demand → staffing conversion |
| `options.executor`, `maxSolveSeconds`, `signal` | | Where/how long to solve, cancellation |

Output (`AutoScheduleResult`):

- `assignments`: `{ staffId, shiftId, dayOfWeek }[]`. IDs and `scheduleId` are added by the caller (Phase 8), the same way manual assignments get them.
- `status`: `optimal` (proven best) or `feasible` (time limit hit; best found, still valid).
- `shortfalls`: `{ dayOfWeek, hour, required, staffed }[]` for hours that remain understaffed.
- `surplusStaffHours`, `hoursByStaff`, and `notes` (e.g. "No transaction data").

Existing assignments are **ignored**: the generator always builds a roster from scratch. How regeneration treats manual edits is a Phase 8 UX decision.

## 3. Step 1 — Demand to required staffing

Transaction counts are a proxy for demand, not a staffing number, so we convert them with one rule:

```
required(day, hour) = ceil(transactionCount / TRANSACTIONS_PER_STAFF_HOUR)
```

Default `TRANSACTIONS_PER_STAFF_HOUR = 15`, defined once in `demand.ts` and overridable through `options`. Missing (day, hour) cells count as 0 transactions → 0 required. A target ≤ 0 is rejected.

Why 15? Against the sample CSV (peaks ≈ 64/h, typical 30–45/h, late evening < 10/h) it gives 5 / 2–3 / 1 staff: busy hours get clearly more people, quiet open hours still get one. It is an assumption, not a requirement; it is kept adjustable.

Example (Tuesday): 12 pm = 52 transactions → `ceil(52/15) = 4`; 10 pm = 5 → 1; 6 am = 0 → 0.

The result is a 7 × 24 grid `required[day][hour]`.

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

CP-SAT minimises one weighted sum of penalties.

**a) Understaffing (shortfall).** For every (day, hour) with `required > 0`:

```
shortfall[d][h] ≥ required[d][h] − staffed[d][h]      (≥ 0)
```

One unit = one missing person for one hour. This pushes staff toward busy hours: an hour with 5 required and 2 staffed costs 3 units, a quiet hour with 1 required and 0 staffed costs 1, so the solver covers the bigger gaps first when capacity is limited.

**b) Overstaffing (surplus).** 

```
surplus[d][h] ≥ staffed[d][h] − required[d][h]        (≥ 0)
```

Shift templates are coarse, so some surplus is unavoidable, but penalising it stops the solver from padding hours just to look fair. Hours with `required = 0` (no demand) also count surplus, so nobody is scheduled into hours with no transactions unless a template forces it.

**c) Fairness (utilization spread).** Fairness is measured against each person's *own* capacity, so a 20 h part-timer and a 40 h full-timer are treated proportionally:

```
util[e]  = floor(1000 · minutes[e] / (maxWeeklyHours[e] · 60))     (permille, via integer division)
spread   = max(util[e]) − min(util[e])
```

Minimising `spread` pulls employees toward the same percentage of their maximum and discourages the "zero hours for one person, full for another" outcome (requirement 2.5 items 5–6). It only matters *after* demand is met, because of the weights below.

**Objective:**

```
minimise  10000 · Σ shortfall  +  300 · Σ surplus  +  1 · spread
```

The weights express priority: covering demand ≫ not overstaffing ≫ fairness tie-breaking. One missing person-hour outweighs any realistic fairness gain (spread ≤ 1000), and a 10-point spread improvement (100) is worth less than a third of one surplus person-hour. The three weights are named constants; the test scenarios in section 9 pin their intended behaviour, and they are the knob to adjust if the output feels off.

## 7. Step 5 — Solve and decode

- Solver: `CpSat.solve(model, { executor, numWorkers: 1, randomSeed: 1, maxDeterministicTime, maxTimeInSeconds })`.
- **Deterministic:** one worker, fixed seed and a machine-independent deterministic time limit give the same roster for the same input (verified in the spike: three identical runs). A wall-clock `maxTimeInSeconds` is only a safety net.
- Status handling: `OPTIMAL` → `optimal`; `FEASIBLE` (limit hit) → `feasible`; otherwise an error is raised (should not occur, since the empty roster is always feasible).
- Variable values come back as `bigint`; an assignment exists when `value === 1n`.
- Metrics (`shortfalls`, `surplusStaffHours`, `hoursByStaff`) are **recomputed in plain TypeScript from the decoded assignments**, not read from solver variables, so the report is independent of the model and matches the Coverage view.
- Symmetry breaking: employees with the same maximum are interchangeable, so their weekly minutes are ordered (`minutes[i] ≥ minutes[i+1]`). This removes equivalent solutions and speeds up proving optimality; it does not change the best objective value.
- Time limit defaults to 5 s (deterministic); large, highly symmetric inputs may return `feasible` rather than `optimal`.
- Browser: run with `executor: 'worker'` so the UI stays responsive; `signal` (AbortSignal) allows cancelling.

## 8. Edge cases

| Situation | Behaviour |
| --- | --- |
| No transaction data / all counts zero | Empty assignments, note "No demand data"; solver is not even loaded |
| No staff or no valid shifts | Empty assignments, note explaining why |
| Employee with `maxWeeklyHours = 0` | Never assigned; excluded from fairness |
| Not enough capacity | Valid roster within caps; unmet hours listed in `shortfalls` |
| Day with no demand | No assignments that day |
| Overlapping shift templates | Allowed to coexist; one employee never gets two overlapping ones |
| Overnight shifts | Out of scope (end must be after start), as elsewhere in the app |

## 9. Worked mini-example

Two employees, A (max 8 h) and B (max 4 h); templates S1 09:00–13:00 and S2 11:00–15:00 (overlapping); Monday demand: 9–10 am → 1, 11 am–1 pm → 2, 2 pm → 1.

- A cannot take both S1 and S2 (overlap) and B's cap is one 4 h shift.
- Best roster on Monday: A → S1 (09–13) and B → S2 (11–15). The 09:00 and 10:00 hours have 1 staffed ✔; the 11:00 and 12:00 hours have both working → 2 ✔; the 13:00 hour has only B → 1 but nothing is required (one surplus hour); the 14:00 hour has B → 1 ✔.
- Result: shortfall 0, surplus 1. Utilization: A 4/8 = 500‰, B 4/4 = 1000‰, spread 500. Giving A a second, non-overlapping shift (if one existed) would improve fairness only if it created no surplus penalty worth more than the gain, which is exactly the trade-off the weights encode.

## 10. Performance

Model size is `staff × 7 × shifts` booleans plus about 168 coverage constraints. Measured in the spike (Node, one worker): 5 staff / 4 shifts ≈ 50–220 ms; 15 staff / 6 overlapping shifts ≈ 0.4 s; all scenarios solved to optimality. Browser Chromium cold start ≈ 130–170 ms plus a one-time download of the WASM runtime (≈ 2.7 MB gzip).

## 11. Why CP-SAT rather than a greedy heuristic

A greedy approach (fill the biggest gap, give it to the least-utilised employee) is simpler but handles overlapping templates, per-person caps and the coverage/fairness trade-off poorly and gives no optimality guarantee. CP-SAT states the rules declaratively, finds provably good solutions at this problem size and reports whether it is optimal. Trade-offs: a ≈ 21 MB dependency (≈ 2.7 MB over the wire in Chromium), browser cross-origin-isolation headers (COOP/COEP) required for local solving (Phase 8 work), and a library banner printed on first solve.

## 12. Known limitations / possible later work

- Demand rule is a single linear ratio; real demand may need per-hour targets or minimum staffing (e.g. always ≥ 2 at opening).
- No employee availability, skills, breaks, minimum shift counts or preferred days.
- Fairness considers weekly hours only, not distribution of busy/unpopular shifts.
- Regeneration ignores existing assignments (Phase 8 decides how to preserve manual work).

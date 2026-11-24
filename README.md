# Employee Scheduler

A weekly staff scheduling app for retail and food-service managers. Build a Monday–Sunday roster, upload hourly transaction data, let Auto-schedule draft the week, then adjust it by hand and publish.

Built with React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand, Papa Parse and OR-Tools CP-SAT (WebAssembly).

## How to install and run

Requires Node.js 20.19+ or 22.12+ (a Vite 8 requirement).

```bash
npm install
npm run dev        # development server (http://localhost:5173)
```

Other commands:

```bash
npm test           # unit tests (vitest)
npm run typecheck  # TypeScript check
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

Try it with the sample report `sample_transaction_interview.csv`: create a schedule for any week, add a few employees and shifts, then **Upload transactions** and choose that file.

Data is saved in your browser (IndexedDB), so it survives a refresh but is not shared between browsers or devices.

### Auto-scheduling and cross-origin isolation

Auto-schedule runs the OR-Tools CP-SAT solver (`cp-sat-wasm`) in a web worker, which needs `SharedArrayBuffer`, so the page must be cross-origin isolated. Vite sends the required headers in `dev` and `preview`. **A production host must send them too**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Hosts that cannot set headers (for example GitHub Pages) cannot run Auto-schedule; the app then shows an error and the rest of the roster keeps working. All fonts and assets are self-hosted, so these headers do not block anything.

## Approach to the auto-scheduler

Auto-schedule treats the week as a small **constraint optimization problem** and solves it with Google OR-Tools CP-SAT in the browser. The full design is in [`algorithm.md`](algorithm.md); in short:

1. **Demand to headcount.** Each hour's transactions become a required number of employees: `ceil(transactions ÷ N)`, at least 1 when there is any demand. `N` (transactions one employee handles per hour, default 15) is set per week in the Upload transactions dialog.
2. **Decisions.** For every employee, day and shift there is a yes/no choice: "works this shift on this day".
3. **Rules that are never broken.** No employee gets overlapping shifts, and no employee goes over their maximum weekly hours (there is no overtime). The same rules block manual edits.
4. **Goals, in strict priority order.** (1) Minimize understaffed hours, (2) don't schedule hours nobody needs, (3) spread hours fairly, measured as a share of each person's own maximum so a 20 h and a 40 h employee are compared proportionally. Each goal is solved in turn and locked in before the next, so there are no weights to tune.
5. **Result.** An editable **draft**, never published automatically. Coverage gaps that the available hours can't fill are shown as understaffed hours instead of being covered with overtime. The result is deterministic (fixed seed, one worker). Re-running Auto-schedule replaces the week's assignments, including manual ones.

CP-SAT was chosen over a greedy heuristic because overlapping shifts, per-person caps and the coverage/fairness trade-off are awkward for greedy rules and give no guarantee of quality; at this problem size CP-SAT solves in well under a second.

## Assumptions

- A schedule is one week, Monday–Sunday, and owns its own employees, shifts, transactions and assignments. Copying a previous week creates an independent copy.
- Shifts are same-day, have a start and end time, and may overlap each other. Several employees can work the same shift; one employee can't work two overlapping shifts. Overnight shifts are not supported.
- **Maximum weekly hours are a hard limit.** New assignments over the limit are blocked. Editing a shift or a maximum can push someone over in a draft (it is highlighted), but a schedule with overlaps or over-limit employees can't be published.
- Demand is the hourly transaction count from the uploaded report. Required staffing is `transactions ÷ N` rounded up, with `N` = 15 by default. This is an assumption, not derived from the data; the manager can change it. Hours with no transactions need no staff, because opening hours aren't known.
- Every hour a shift touches counts as staffed for that hour (a 07:30 start counts toward the 07:00 hour).
- Not modelled: availability, time off, skills, breaks, minimum staffing, pay rates and labor cost, preferred days, and shift swaps.
- Transaction reports are CSV files laid out like the supplied sample (optional title row, weekday columns, hour rows). Columns are matched by weekday name, not by date.
- Single user, no login, no server. Data lives only in this browser.

## Research: how existing tools approach this

**Method and limits.** I studied Deputy and When I Work. The notes below are a first draft from product pages, help-centre articles and vendor comparisons; they are to be replaced by first-hand notes from using the products as a manager.

**What I looked at, from a manager's seat.** The manager's job is to turn expected demand into a roster, cover busy periods, replace someone who is out, and keep people within their hours.

- **Deputy** drafts a roster from a demand forecast built from past sales and payroll data (or a forecast the manager types in), and its own guidance is that the manager still reviews and approves the draft. Overtime is surfaced while scheduling: a per-location setting shows an "overtime" warning on a shift that would trigger overtime pay, with a cost breakdown and a "Team member not recommended" alert. The manager can then pick someone else or choose "Schedule anyway".
- **When I Work** centers on the weekly grid, with overtime thresholds and alerts shown while scheduling, labor-cost visibility, and shift swap, drop and open-shift workflows, which is the day-to-day "someone called in sick" flow.

**Ideas I adopted, and why**

- **Demand, then draft, then manager edits.** Both tools separate "how many people does this hour need" from "who works when", and treat the generated roster as a draft the manager owns. I did the same: transactions become headcount through one visible number (transactions per employee per hour), and Auto-schedule produces an editable draft.
- **Show hours and gaps on the roster itself.** The tools surface overtime and coverage gaps where the manager is already looking. Here, each employee's `hours / maximum` sits under their name (amber when over), overlapping shifts turn the cell red, and each day header shows how many hours are understaffed, with an hour-by-hour coverage view one click away.
- **Overtime shown while scheduling.** Both tools flag overtime on the schedule itself rather than in a report afterwards, so here the hour limit is enforced while the manager edits and inside the optimizer.

**One thing I did differently, and why.** Deputy lets a manager schedule someone into overtime ("Schedule anyway") after seeing the cost. I made maximum weekly hours a **hard limit**: new assignments over the limit are refused, and a schedule over the limit can't be published. This app has no pay rates, so there is no cost to weigh against the overtime, and a silent override would make the maximum meaningless; a visible, blocking rule is easier for a manager to trust. The trade-off is that a short-staffed week shows understaffing instead of a costly but fully covered roster.

I also kept demand simple on purpose: Deputy forecasts from sales history, while this app takes the week's actual hourly transactions as given and uses one adjustable ratio, because the brief supplies the hourly counts and a forecast would add complexity without improving the roster the manager can see.

**Sources**

- Deputy: [Demand forecasting](https://www.deputy.com/features/demand-forecasting), [Smart scheduling](https://www.deputy.com/features/smart-scheduling), [Overtime tags and warnings (help)](https://help.deputy.com/hc/en-au/articles/15192896170895-How-do-I-enable-and-understand-overtime-tags-and-warnings-on-the-schedule-BETA)
- When I Work: [7shifts vs. When I Work (vendor comparison)](https://wheniwork.com/blog/7shifts-vs-wheniwork)

## Project documents

- [`REQUIREMENTS.md`](REQUIREMENTS.md): functional requirements and acceptance criteria
- [`ERD.md`](ERD.md): entities, relationships and data constraints
- [`algorithm.md`](algorithm.md): auto-scheduler design
- [`ROADMAP.md`](ROADMAP.md): implementation phases and decisions

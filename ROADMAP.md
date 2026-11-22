# Development Roadmap

The project will be developed incrementally.

Each phase should leave the application in a working state. Do not implement the entire application in one pass.

Before starting a phase:
1. Read the relevant requirements in `REQUIREMENTS.md`.
2. Inspect the existing implementation.
3. Propose a small implementation plan.
4. Implement only the current phase.

After completing a phase:
1. Run TypeScript checks and the production build.
2. Run relevant tests.
3. Manually inspect the application.
4. Review the code changes.
5. Commit the working implementation.

---
## Phase 1: Project Setup + Weekly Scheduling Layout ✅ Complete

### Goal

Set up the application and build the initial weekly scheduling interface. The app should open on the current week and allow users to navigate between previous and next weeks.

### Scope

**1. Project setup**
- Initialize React + TypeScript + Vite.
- Configure Tailwind CSS.
- Install and configure Zustand.
- Install Lucide React for icons.
- Establish the initial project structure.

**2. Weekly navigation**
- Display the current week's date range (Monday–Sunday).
- Automatically select the current week when the application opens.
- Provide Previous Week and Next Week navigation.
- Provide a button to return to the current week.
- Use the Monday date as the schedule ID, formatted as `YYYY-MM-DD`.
- Calculate week navigation by adding or subtracting seven days.
- If the user navigates to a week without an existing schedule, display an empty schedule state. Do not automatically create a schedule just because the user navigates to that week.

**3. Main application layout**
- **Header:** Application name, current week date range, previous/next week controls, and a button to return to the current week.
- **Roster workspace:** Display the weekly roster with employees as rows and Monday–Sunday as columns.
- **Shift display:** Show assigned shifts and their start/end times within the corresponding day.
- **Empty state:** Show a helpful message when no employees or assignments exist.
- Do not implement navigation tabs or additional application sections in this phase.

**4. Initial mock data**

Initialize the interface with exactly:
- 2 mock employees, each with a name and maximum weekly hours.
- 2 default shift templates:
  - 07:00–15:00
  - 15:00–23:00
- A small number of mock assignments using these employees and shifts to demonstrate the weekly roster layout.

Keep mock data separate from UI components so it can be replaced by real domain models in later phases.

**5. Date utilities**

Implement reusable date utilities:
- `getMonday(date)` — returns the Monday of the given week.
- `getScheduleId(date)` — returns the Monday date as `YYYY-MM-DD`.
- `moveWeek(scheduleId, offset)` — returns the schedule ID for a week offset.

Use local date operations to avoid timezone-related date shifts.

### Acceptance Criteria

- [x] The application starts successfully.
- [x] The current week is selected automatically on startup.
- [x] The week header displays the correct Monday–Sunday date range.
- [x] Previous Week and Next Week navigate in seven-day increments.
- [x] The current week button returns to the current week.
- [x] Schedule IDs consistently use the Monday date in `YYYY-MM-DD` format.
- [x] Navigating to another week does not automatically create a schedule.
- [x] ~~The roster displays exactly 2 mock employees.~~ (superseded in Phase 2: mock data removed)
- [x] ~~The roster demonstrates both default shifts.~~ (superseded in Phase 2: mock data removed)
- [x] The weekly roster layout is clear and understandable.
- [x] The layout works at desktop screen sizes.
- [x] Type checking and production build pass.

### Out of Scope

- Real employee management.
- Shift template management.
- Manual assignment editing.
- CSV importing.
- Coverage calculations.
- Auto-scheduling.
- localStorage persistence.
- Navigation tabs and additional application sections.

These will be implemented in subsequent phases.

## Phase 2 — Domain Models and Staff Management ✅ Complete

**Goal:** Implement the core data model and employee management.

Tasks:

- [x] Define Schedule, Staff, Shift, Assignment, and Transaction domain models.
- [x] Define day-of-week and time representations.
- [x] Create schedules via a "+ New schedule" button on weeks without one, seeded with the default shifts (no sample data).
- [x] Remove mock data.
- [x] Implement employee creation.
- [x] Implement employee editing.
- [x] Implement employee deletion.
- [x] Display maximum weekly hours.
- [x] Calculate assigned weekly hours.

**Completion criteria:**

- Users can manage employees through the UI.
- Employee information is reflected in the roster.
- Domain models are independent of React components.
- A week without a schedule shows a placeholder with a "+ New schedule" button.

## Phase 3 — Shift Management ✅ Complete

**Goal:** Allow managers to configure reusable shift templates.

Tasks:

- [x] Seed default shifts (07:00–15:00 and 15:00–23:00) — seeded when a schedule is created (Phase 2).
- [x] Display available shift templates.
- [x] Add shift templates.
- [x] Edit shift templates.
- [x] Remove shift templates.
- [x] Validate start and end times.
- [x] Handle changes to templates that already have assignments.
- [x] Deleting a template removes its assignments after confirmation. ~~Block template edits that would overlap an employee's assignments~~ (superseded in Phase 4: such edits are saved as draft changes and highlighted; publishing is blocked until resolved).

**Completion criteria:**

- Users can manage shift templates.
- Multiple employees can share the same shift.
- Different shift templates can overlap.
- Invalid shift configurations are handled clearly.

## Phase 4 — Manual Roster Editing (draft/publish workflow pending manual check)

**Goal:** Make the roster fully usable without auto-scheduling.

Tasks:

- [x] Display assignments in the weekly roster.
- [x] Assign an employee to a shift on a particular day.
- [x] Reassign an employee (via "Change shift" on an assignment, or remove and assign another employee; no move-to-employee action).
- [x] Remove assignments.
- [x] Display shift times clearly (assignments in a cell are always sorted by start time).
- [x] Calculate weekly hours per employee.
- [x] Prevent overlapping assignments for the same employee (including the identical shift twice on one day, hidden from the assign and change-shift menus; the "+" button is hidden once every shift is assigned).
- [x] Warn when an employee exceeds maximum weekly hours.
- [x] Add useful empty states and assignment feedback.
- [x] Add schedule status: `draft` (new schedules) and `published`.
- [x] First change to a published schedule automatically starts a draft copy; the published version is kept until publish or discard. Changes: assignments, staff, and adding/editing/deleting shift templates.
- [x] Publish replaces the published schedule with the draft and clears the draft; only allowed when no assignments overlap.
- [x] Discard changes restores the last published schedule.
- [x] Exceeding maximum weekly hours stays a warning and never blocks publishing.
- [x] While a published schedule has a draft, removed assignments stay in the roster as a struck-through, faded badge until publish; hovering shows a Revert button. Revert is allowed even if it creates an overlap (highlighted, publishing blocked); it is disabled only if the shift template was deleted (Discard changes restores it). A shift pending removal is not offered in the + or Change shift menus; Revert is the only way back.
- [x] Assignments added in the draft (not yet published) are shown with a grey badge instead of the shift colour.
- [x] Shift template edits that make an employee's shifts overlap are saved (as a draft change); the affected roster cells are highlighted and publishing stays blocked until the overlap is resolved. New overlapping assignments are still blocked in the + / Change shift menus.
- [x] Discard changes also restores shift templates (added, edited, or deleted).
- [ ] Manually verify the Publish button (disabled and labelled "Published" once published) and Discard changes in the browser.

**Completion criteria:**

- Managers can create a complete weekly roster manually.
- Multiple employees can work the same shift.
- Employee conflicts are prevented.
- Weekly hours update immediately after edits.

## Phase 5 — Transaction CSV Import ✅ Complete (manual browser check pending)

**Goal:** Import and display weekly demand data.

Tasks:

- [x] Inspect the supplied CSV file.
- [x] Understand its exact column and row structure.
- [x] Implement CSV parsing using Papa Parse.
- [x] Validate the imported data.
- [x] Handle missing, invalid, or duplicate hourly records.
- [x] Map transactions to Monday–Sunday and hourly time slots.
- [x] Display imported demand data.
- [x] Allow users to replace the imported report.

**Completion criteria:**

- The supplied sample CSV imports successfully.
- Hourly transaction counts are mapped to the correct days and hours.
- Invalid files produce understandable errors.
- Imported data can be reviewed.

**Scope notes / changes:**

- Added an "Upload transactions" dialog: it starts with an empty state (CSV template download + upload); the editable hour × Monday–Sunday table appears only after an upload (or when saved data exists) so users can correct individual counts. Changes apply only on Save, Cancel discards them.
- The sample CSV has a title row and Friday–Thursday columns, so columns are mapped by weekday name (dates are informational only).
- Transactions are stored per schedule outside draft/publish snapshots; saving them does not turn a published schedule into a draft.
- Transaction data enters only through CSV upload; the table is a read-only review. The template contains a single example row (8am) — add other hours as rows in the CSV. An "Export transactions" button downloads the table as CSV named with the week's start and end dates (`transactions_<monday>_<sunday>.csv`).
- The template and table headers follow the sample layout: title row with the schedule's date range (e.g. `Aug 10, 2026 - Aug 16, 2026`), dated day headers (`Mon, 10 Aug`), hour rows, BOM + CRLF. The dialog title shows the schedule duration.
- Persistence is still deferred to Phase 9. Hours absent from the data have no record.

## Phase 6 — Coverage Analysis and Aggregated Summary ✅ Complete (manual browser check pending)

**Goal:** Give managers visibility into staffing versus demand.

Tasks:

- [x] Calculate hourly staff coverage.
- [x] Calculate transactions per staff hour.
- [x] Handle zero-staff hours.
- [x] Calculate total weekly staff hours.
- [x] Calculate total weekly transactions.
- [x] Calculate overall transactions per staff hour.
- [x] Calculate average hourly transactions per staff hour.
- [x] Display the aggregated summary.
- [x] Ensure metrics update after every roster edit.

**Completion criteria:**

- All required hourly and weekly metrics are correct.
- Both weekly ratio metrics are displayed separately.
- Manual roster edits immediately update the summary.

**Scope notes / decisions:**

- Daily Coverage (day selector, hourly table, day totals) and Weekly Summary (four metrics) sit under the roster on the same screen; logic is in `src/domain/coverage.ts`.
- Staff hours per hour = distinct employees whose shift touches that clock hour (an off-the-hour shift counts in every hour it touches; overlapping draft assignments for one employee count once).
- Rows = hours in the transaction data plus hours touched by worked shifts; staffed hours missing from the data count as 0 transactions.
- No target ratio or understaffing threshold is assumed. Only objective marker: "No staff" on hours that have transactions but no staff.
- With no transaction data, Coverage and Weekly Summary show an upload prompt instead; the roster stays usable.
- Added the shadcn `card` component.
- Follow-up: the Roster and Summary are separate tabs (shadcn `tabs` added). Publish bar and the Upload transactions / Shifts buttons stay above the tabs; Daily Coverage and Weekly Summary live in the Summary tab. Selected tab is local UI state.

## Phase 7 — Auto-Scheduling Algorithm ✅ Complete

**Goal:** Generate a sensible draft roster based on demand and employee constraints.

Tasks:

- [x] Define a demand-to-staffing conversion rule.
- [x] Document the selected assumptions (see `algorithm.md`: demand rule, hard hour cap, objective weights, fairness definition; solver choice `cp-sat-wasm` validated by spike).
- [x] Define scheduling input and output types.
- [x] Implement employee maximum-hours constraints.
- [x] Implement employee overlap constraints.
- [x] Implement demand coverage evaluation.
- [x] Implement fairness evaluation.
- [x] Generate assignments across all seven days.
- [x] Handle insufficient staffing capacity.
- [x] Write unit tests for the scheduling algorithm.

Test scenarios:

- [x] Uniform demand throughout the week.
- [x] High demand during lunch or dinner.
- [x] Very low employee capacity.
- [x] Employees with different maximum weekly hours.
- [x] Overlapping shift templates.
- [x] Insufficient staff to cover demand.
- [x] No transaction data.
- [x] Zero transaction counts.

**Completion criteria:**

- Algorithm generates valid assignments.
- Employee maximum weekly hours are respected as far as possible (hard limit since Phase 8 follow-up 5: no overtime).
- Employee assignments never overlap.
- Busy hours receive more staffing than quieter hours when feasible.
- Work is distributed reasonably fairly.
- Algorithm works independently of React and Zustand.

Scope notes:

- Algorithm is documented in `algorithm.md`; code is `src/domain/demand.ts` (transaction grid, demand-shared required staffing) and `src/domain/auto-schedule.ts` (`generateSchedule`, CP-SAT model). Domain only: no UI, store or Vite config changes.
- New dependency: `cp-sat-wasm` (OR-Tools CP-SAT in WebAssembly), validated by a spike in Node and Chromium before adoption. It is imported lazily inside `generateSchedule`, so trivial runs (no demand, no staff) never load WASM.
- Decisions: the generator originally treated maximum weekly hours as a hard cap (briefly a soft limit; a hard limit again since Phase 8 follow-up 5); regeneration ignores existing assignments (Phase 8 decides how to preserve manual work); fairness is the spread of utilization (assigned hours / own maximum); employees with the same maximum are symmetry-broken to speed up solving.
- Results are deterministic (1 worker, fixed seed, deterministic time limit; default 5 s). When the limit is hit the best valid roster is returned with status `feasible`; an optimal proof is not guaranteed for large, symmetric inputs.
- Library quirks: `result.status` should be read via `statusName()`; variable values are `bigint`; a "OR-Tools WASM Cloud" banner is printed on first solve.
- Tests: `demand.test.ts`, `auto-schedule.test.ts` (all roadmap scenarios, determinism, larger 30-employee case, scale invariance, priorities, brute-force oracle).
- Scope change (follow-up): removed the hardcoded 15 transactions-per-staff-hour target; it was an arbitrary business assumption. Transaction counts are relative demand weights (concave proportional objective, no labor-cost term, so no hidden threshold). Transactions per staff hour remains an evaluation metric in Coverage. `AutoScheduleResult` gained `unstaffedHours`; (superseded by follow-up 3: the proportional objective was replaced by lexicographic stages). Consequence: employees are scheduled toward the same % of their maximum hours.

## Phase 8 — Auto-Scheduling Integration and UX Refinement

**Goal:** Integrate automatic scheduling into the manager workflow.

Tasks:

- [x] Add Auto-schedule action.
- [x] Display generated assignments in the roster.
- [x] Allow managers to review and edit the generated draft.
- [x] Make regeneration behavior explicit.
- [x] Display understaffing warnings (use `unstaffedHours` from the generator; no target ratio assumed).
- [x] Display employee maximum-hours warnings.
- [x] Ensure coverage metrics update immediately.
- [ ] Refine assignment interactions.
- [x] Improve empty, loading, and error states.
- [ ] Configure Vite for `cp-sat-wasm`: `optimizeDeps.exclude: ['cp-sat-wasm']`, `include: ['protobufjs']`, `worker.format: 'es'`, and COOP/COEP headers on `server` and `preview` (verified in Chromium; Firefox/Safari untested).
- [ ] Confirm the production host can send COOP/COEP headers (e.g. GitHub Pages cannot) and that other assets stay compatible.
- [ ] Run the solver with `executor: 'worker'`, support cancel via `AbortSignal`, and show loading/error states; the WASM download is about 2.7 MB gzip in Chromium.
- [x] Decide how regeneration treats existing manual assignments.

**Completion criteria:**

- Manager can generate, review, and modify a draft.
- Manual edits are not silently discarded.
- Problems are communicated clearly.
- Roster and coverage views stay synchronized.

Scope notes:

- Scope change (follow-up 1): the generator no longer treats maximum weekly hours as a hard cap (it contradicted the "warning, not a restriction" rule). Overtime is a minimised soft cost; `AutoScheduleResult` gained `overMaxStaff`.
- Scope change (follow-up 2, reverted): a manager-chosen transactions-per-employee-hour target (Auto-schedule input dialog pre-filled with 15, stored per schedule, Coverage "Understaffed" flag) was built and then removed in favour of the simpler ratio-free algorithm above. The leftover opt-in domain option was removed in follow-up 3.
- Status: implemented; the Vite config, worker run/cancel and production-host items stay unchecked until verified in a real browser. Verified so far: verified by unit/store tests, type check, lint, build and the `preview` response headers. **Manual browser check pending** (generate, edit, replace + undo, cancel, published-week draft, missing-isolation error).
- Regeneration decision: Auto-schedule replaces all assignments of the viewed week. If any exist, a confirmation dialog states the count; afterwards an Undo restores them (`autoScheduleUndo` in the store, cleared by the next change so it never overwrites later edits). A published week becomes a draft and its published version is kept (Discard still works). Keep-and-fill was considered and not built.
- Understaffing warning = hours with transactions but no staff (`unstaffedHours`); no target ratio. (Superseded by follow-ups 3–5: understaffing is measured against 15 transactions per staff hour and nobody is scheduled over their maximum.) `OverMaxAlert` now only appears after template/maximum edits. Coverage and roster derive from the store, so they update immediately.
- Hosting: COOP/COEP set for Vite `server` and `preview` only; production host must send them (documented in README; GitHub Pages cannot). Missing isolation shows an error state instead of failing silently.
- Code: `replaceAssignments` (assignment.ts), `auto-schedule-report.ts`, store actions `applyGeneratedAssignments`/`undoAutoSchedule`, `use-auto-schedule.ts`, `auto-schedule-panel.tsx`. No new shadcn components or dependencies (Undo is inline in an Alert, not a toast).
- Scope change (follow-up 3): **scheduling priority selection.** `coverage_first` (default) or `overtime_first`, chosen in a new Auto-schedule dialog (radio cards; replaces the replace-confirmation, which is now a warning inside it) and remembered in the store (`schedulingSettings`, `setSchedulingPriority`). The generator now optimizes lexicographically (understaffing / overtime in the chosen order, then total hours, then fairness) instead of one weighted score; all weights and the opt-in `transactionsPerStaffHour` mode were removed. Understaffing = person-hours below the team's capacity shared by demand (`allocateRequiredStaff`, superseded by follow-up 4). The banner reports priority, understaffed ranges ("planned N, has M"), overtime and a trade-off note. New: `scheduling-settings.ts`, `evaluateRoster`, `objectiveOrder`, shadcn `radio-group`. Tests include a brute-force lexicographic oracle. Manual browser check of the dialog pending.
- Scope change (follow-up 4): **fixed staffing target of 15 transactions per staff hour.** `required = max(1, ceil(transactions / 15))` for hours with transactions (`TRANSACTIONS_PER_STAFF_HOUR`, `requiredStaffFor`, `buildRequiredGrid` in `demand.ts`); understaffing = Σ max(0, required − staffed). Replaces the capacity-shared-by-demand requirement, so requirements no longer depend on team size. Not manager-configurable (no input, no setting); the dialog and banner only state the assumption. Justification is in `algorithm.md`. Scale invariance of the roster was removed on purpose.
- Scope change (follow-up 5): **overtime strictly avoided.** Maximum weekly hours are now a hard limit. Auto-schedule never exceeds them (hard constraint; stages: understaffing, total hours, fairness) and the priority selector, `scheduling-settings.ts`, the store setting and the `radio-group` card UI were removed (the replace confirmation is an `AlertDialog` again). Manual assignment is blocked with an `over-max` reason (`assignShift`, `changeAssignmentShift`, `restoreAssignment`; swaps ignore the replaced assignment). A shift-template or maximum-hours edit may still leave an employee over in a draft: it is highlighted (`OverMaxAlert`, now destructive) and **blocks publishing** (`validateForPublish.ok`, publish bar). This reverses the original "warning, not a restriction" wording; `CLAUDE.md`, `REQUIREMENTS.md` and `ERD.md` were updated. Supersedes follow-ups 1 and 3 (soft maximum, priority selection). Manual browser check pending.
- Not done: "Refine assignment interactions" is left open (no concrete changes beyond clearing Undo on manual edits).

## Phase 9 — Persistence, Testing, and Final Polish

**Goal:** Make the application reliable and ready for submission.

Tasks:

- [ ] Persist schedules and their data in localStorage.
- [ ] Restore data after browser refresh.
- [ ] Handle missing or corrupted stored data.
- [ ] Add sample/demo data reset functionality.
- [ ] Test multiple schedules.
- [ ] Test the complete manager workflow.
- [ ] Verify calculations against manually calculated examples.
- [ ] Test edge cases and invalid inputs.
- [ ] Fix UI inconsistencies.
- [ ] Check desktop and tablet layouts.
- [ ] Run the production build.
- [ ] Prepare the AI usage note.

**Completion criteria:**

- Application works end-to-end.
- Data survives browser refresh.
- Required acceptance criteria pass.
- No critical runtime or build errors.
- Final UI is clear and pleasant to use.

---

## Development Rules

- Complete phases in order unless a dependency requires otherwise.
- Do not implement future phases prematurely.
- Keep each implementation task small enough to review.
- Avoid unnecessary refactoring.
- Keep scheduling and aggregation logic independently testable.
- Update this roadmap with every change: check off tasks as they are verified, and record new, changed, or dropped scope.
- Do not mark a task complete merely because code was generated; verify its behavior.

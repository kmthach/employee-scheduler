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
- [x] Block template edits that would overlap an employee's assignments; deleting a template removes its assignments after confirmation.

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
- [x] First change to a published schedule automatically starts a draft copy; the published version is kept until publish or discard. Changes: assignments, staff, and editing/deleting a used shift. Adding a shift, and editing/deleting an unused shift, do not start a draft.
- [x] Publish replaces the published schedule with the draft and clears the draft; only allowed when no assignments overlap.
- [x] Discard changes restores the last published schedule.
- [x] Exceeding maximum weekly hours stays a warning and never blocks publishing.
- [x] While a published schedule has a draft, removed assignments stay in the roster as a struck-through, faded badge until publish; hovering shows a Revert button (disabled with a reason if the assignment would now overlap). A shift pending removal is not offered in the + or Change shift menus; Revert is the only way back.
- [x] Assignments added in the draft (not yet published) are shown with a grey badge instead of the shift colour.
- [ ] Manually verify the Publish button (disabled and labelled "Published" once published) and Discard changes in the browser.

**Completion criteria:**

- Managers can create a complete weekly roster manually.
- Multiple employees can work the same shift.
- Employee conflicts are prevented.
- Weekly hours update immediately after edits.

## Phase 5 — Transaction CSV Import

**Goal:** Import and display weekly demand data.

Tasks:

- [ ] Inspect the supplied CSV file.
- [ ] Understand its exact column and row structure.
- [ ] Implement CSV parsing using Papa Parse.
- [ ] Validate the imported data.
- [ ] Handle missing, invalid, or duplicate hourly records.
- [ ] Map transactions to Monday–Sunday and hourly time slots.
- [ ] Display imported demand data.
- [ ] Allow users to replace the imported report.

**Completion criteria:**

- The supplied sample CSV imports successfully.
- Hourly transaction counts are mapped to the correct days and hours.
- Invalid files produce understandable errors.
- Imported data can be reviewed.

## Phase 6 — Coverage Analysis and Aggregated Summary

**Goal:** Give managers visibility into staffing versus demand.

Tasks:

- [ ] Calculate hourly staff coverage.
- [ ] Calculate transactions per staff hour.
- [ ] Handle zero-staff hours.
- [ ] Calculate total weekly staff hours.
- [ ] Calculate total weekly transactions.
- [ ] Calculate overall transactions per staff hour.
- [ ] Calculate average hourly transactions per staff hour.
- [ ] Display the aggregated summary.
- [ ] Ensure metrics update after every roster edit.

**Completion criteria:**

- All required hourly and weekly metrics are correct.
- Both weekly ratio metrics are displayed separately.
- Manual roster edits immediately update the summary.

## Phase 7 — Auto-Scheduling Algorithm

**Goal:** Generate a sensible draft roster based on demand and employee constraints.

Tasks:

- [ ] Define a demand-to-staffing conversion rule.
- [ ] Document the selected assumptions.
- [ ] Define scheduling input and output types.
- [ ] Implement employee maximum-hours constraints.
- [ ] Implement employee overlap constraints.
- [ ] Implement demand coverage evaluation.
- [ ] Implement fairness evaluation.
- [ ] Generate assignments across all seven days.
- [ ] Handle insufficient staffing capacity.
- [ ] Write unit tests for the scheduling algorithm.

Test scenarios:

- [ ] Uniform demand throughout the week.
- [ ] High demand during lunch or dinner.
- [ ] Very low employee capacity.
- [ ] Employees with different maximum weekly hours.
- [ ] Overlapping shift templates.
- [ ] Insufficient staff to cover demand.
- [ ] No transaction data.
- [ ] Zero transaction counts.

**Completion criteria:**

- Algorithm generates valid assignments.
- Employee maximum weekly hours are respected.
- Employee assignments never overlap.
- Busy hours receive more staffing than quieter hours when feasible.
- Work is distributed reasonably fairly.
- Algorithm works independently of React and Zustand.

## Phase 8 — Auto-Scheduling Integration and UX Refinement

**Goal:** Integrate automatic scheduling into the manager workflow.

Tasks:

- [ ] Add Auto-schedule action.
- [ ] Display generated assignments in the roster.
- [ ] Allow managers to review and edit the generated draft.
- [ ] Make regeneration behavior explicit.
- [ ] Display understaffing warnings.
- [ ] Display employee maximum-hours warnings.
- [ ] Ensure coverage metrics update immediately.
- [ ] Refine assignment interactions.
- [ ] Improve empty, loading, and error states.

**Completion criteria:**

- Manager can generate, review, and modify a draft.
- Manual edits are not silently discarded.
- Problems are communicated clearly.
- Roster and coverage views stay synchronized.

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

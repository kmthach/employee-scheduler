# Staff Scheduling Application — Requirements

## 1. Overview

Build a web application for managers of retail and food-service stores to plan weekly staff schedules.

The application should help managers answer:

- Who should work, and when?
- Do we have enough staff during busy hours?
- Are working hours distributed fairly?
- Does the schedule respect each employee's maximum weekly hours?

The application represents one typical week, Monday through Sunday.

Prioritize a clear, efficient experience for non-technical store managers.

## Data Model

See [ERD.md](./ERD.md) for the entity relationship diagram,
entity definitions, relationships, and business constraints.

Follow the ERD when implementing data models. If a requirement
appears to conflict with the ERD, identify the conflict before
making changes.

## 2. Functional Requirements

### 2.1 Schedule Management

- Users can create schedules.
- A schedule is the top-level container for all related data:
  - Staff
  - Transaction data
  - Shift templates
  - Roster assignments
- Each schedule represents a typical Monday–Sunday week.
- Users can switch between schedules.

### 2.2 Staff Management

Users can add, edit, and remove staff members.

Each staff member has:

- Unique ID
- Name
- Maximum weekly working hours

The interface should display each employee's assigned weekly hours and maximum hours.

### 2.3 Transaction Data

Users can upload a CSV transaction report.

Requirements:

- Support the supplied sample file: `report_Transaction_20260807_20260813.csv`.
- Parse hourly transaction counts for each day of the week.
- Treat transaction counts as a proxy for store demand.
- Validate the uploaded file and report meaningful errors.
- Display imported transaction data in a readable format.

Inspect the actual sample CSV before implementing the importer. Do not assume its column structure.

### 2.4 Shift Management

A shift template consists of:

- Start time
- End time

The first schedule is seeded with:

- 07:00–15:00
- 15:00–23:00

A later schedule starts from the latest earlier schedule instead: the New schedule dialog (Shifts, Employees, Transactions steps) is pre-filled from it, or "Copy previous schedule" clones it completely (including assignments) as a draft.

Users can:

- Add shift templates.
- Edit shift templates.
- Remove shift templates.

Shift templates are reusable across different days.

Multiple employees can be assigned to the same shift on the same day.

Different shift templates may overlap.

An employee cannot have overlapping assignments on the same day.

Changes to shift templates must be reflected in existing assignments and coverage calculations. Handle deletion or modification of templates with existing assignments carefully.

### 2.5 Auto-Scheduling

Provide an Auto-schedule button that generates a draft weekly roster.

The generated roster should:

1. Assign employees to shift templates across the week.
2. Provide more staff during busier hours.
3. Respect each employee's maximum weekly hours.
4. Avoid overlapping assignments for the same employee.
5. Distribute available working hours fairly.
6. Avoid leaving employees with zero or near-zero hours while others are heavily utilized, when sufficient work and capacity exist.

The algorithm should consider both demand coverage and fairness.

The assignment does not prescribe a specific scheduling algorithm or transactions-per-staff-hour target. Choose a reasonable demand-to-staffing conversion, document the assumption, and keep it adjustable.

The generated roster is a draft, not a final schedule.

Managers must be able to review, edit, and regenerate it.

Regenerating a schedule must not silently destroy manual edits. Make replacement behavior clear.

### 2.6 Aggregated Summary

Display an aggregated table broken down by day and hour.

Each hourly cell must contain:

| Metric | Definition |
|---|---|
| Transactions | Number of transactions during that hour |
| Staff hours | Number of employees working during that hour |
| Transactions per staff hour | Transactions divided by staff hours |

Because each cell represents one clock hour, every employee working during that hour contributes one staff-hour.

When staff hours equal zero, display `–` for transactions per staff hour.

Display these weekly aggregations:

| Metric | Calculation |
|---|---|
| Total staff hours | Sum of hourly staff counts across all days and hours |
| Total transactions | Sum of hourly transaction counts |
| Overall transactions per staff hour | Total transactions / total staff hours |
| Average transactions per staff hour | Arithmetic mean of hourly transactions-per-staff-hour values, excluding cells with zero staff |

The overall ratio and average hourly ratio are different metrics. Both must be displayed.

### 2.7 Roster Viewing and Editing

The roster must be readable and understandable to a non-technical manager.

It must clearly show:

- Days of the week
- Shift times
- Assigned employees

Users must be able to:

- Assign employees to shifts.
- Reassign employees.
- Remove assignments.
- Make edits quickly without navigating through unnecessary forms.

A grid with employees as rows and days as columns is a reasonable design choice, provided shift times and assignments remain clear.

The interface should prioritize direct editing and efficient workflows.

### 2.8 Live Feedback

Whenever the roster changes, update the following immediately:

- Employee weekly hours
- Hourly staffing coverage
- Transactions per staff hour
- Weekly aggregated metrics

Surface warnings for:

- Employees exceeding their maximum weekly hours.
- Understaffed hours relative to estimated demand.
- Invalid or overlapping assignments.

Assignments that would exceed an employee's maximum weekly hours are blocked with a clear explanation. (Deliberate change from the original wording, which only warned; edits to shift templates or maximum hours can still leave an employee over in a draft, which is highlighted and blocks publishing.)

Overlapping assignments for the same employee should be prevented, with a clear explanation.

## 3. Product Assumptions

The assignment intentionally leaves some decisions open.

Use these assumptions:

### Schedule lifecycle

A schedule represents a reusable typical week rather than a specific calendar week.

Provide a way to create schedules, and initialize the application with sample data so users can explore it immediately.

### Demand conversion

Transaction counts are a proxy for demand, not a direct staffing requirement.

Choose a reasonable target or rule to convert hourly transaction counts into required staffing levels.

Document the assumption and avoid hardcoding it throughout the application.

### Fairness

Employees may have different maximum weekly hours.

Measure fairness relative to each employee's available weekly capacity rather than requiring everyone to receive exactly the same number of hours.

When demand or capacity makes equal distribution impossible, prioritize valid assignments and make limitations visible.

### Assignment model

A shift template can have multiple employees assigned to it on the same day.

A single employee cannot work overlapping assignments.

Split shifts are allowed if they do not overlap.

## 4. Non-Functional Requirements

- The application runs entirely in the browser.
- Data persists across browser refreshes.
- The interface is responsive, with desktop as the primary target.
- Business logic is independent of UI components.
- Calculations should be deterministic and testable.
- Invalid data must be handled gracefully.
- The application should remain usable with multiple schedules and a reasonable number of employees and assignments.

## 5. Out of Scope

Unless necessary to satisfy the requirements, do not implement:

- Employee accounts or authentication.
- Payroll calculations.
- Employee availability or time-off management.
- Notifications.
- Publishing schedules to employees (sending or sharing). The in-app draft/published status is in scope.
- Backend services or cloud synchronization.

## 6. Acceptance Criteria

The application is complete when:

- Users can create and switch between schedules.
- Users can add, edit, and remove employees.
- Users can import the supplied transaction report.
- Users can manage reusable shift templates.
- Users can manually assign, reassign, and remove employees from shifts.
- The roster clearly displays days, shift times, and assigned employees.
- Auto-scheduling produces a sensible draft based on demand.
- The algorithm respects maximum weekly hours and prevents employee overlaps.
- Working hours are distributed reasonably fairly.
- The aggregated summary calculates all hourly and weekly metrics correctly.
- Summary values update immediately after roster edits.
- Over-maximum hours and understaffed hours are clearly communicated.
- Data persists after refreshing the browser.

## 7. AI Usage Note

The final submission must include a short note explaining:

- What work was delegated to Claude Code or other AI tools.
- What implementation, logic, and behavior were independently verified.
- Which AI suggestions were changed or rejected and why.

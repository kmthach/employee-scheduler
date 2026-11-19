# Project Instructions

## Project
A weekly staff scheduling application for retail and food-service managers.

See REQUIREMENTS.md for functional requirements and acceptance criteria.
See ERD.md for entity definitions, relationships, and data constraints.
See ROADMAP.md for implementation phases.

## Tech Stack
- React + TypeScript
- Vite
- Tailwind CSS
- Shadcn UI
- Zustand
- Papa Parse
- Lucide React

## Architecture
- Keep business logic independent of React and Zustand.
- Put scheduling algorithms and calculations in `src/domain/`.
- Use Zustand for application state.
- Use localStorage for persistence.
- Organize UI by feature.

## Important Business Rules
- A schedule represents Monday–Sunday.
- A schedule owns its staff, transactions, shifts, and assignments.
- Shift templates have a start and end time.
- Multiple employees can work the same shift.
- Different shift templates may overlap.
- An employee cannot have overlapping assignments.
- Maximum weekly hours are a warning, not a hard restriction.
- Auto-scheduling generates an editable draft.
- Fairness should account for each employee's maximum weekly hours.

## Development Rules
- Implement one roadmap phase at a time.
- Do not implement future phases unless explicitly requested.
- Inspect existing code before making changes.
- Plan before implementing substantial changes.
- Avoid unnecessary dependencies and abstractions.
- Write tests for business logic and calculations.
- Run type checks and builds after implementation.
- Do not make unrelated changes.
- 
## UI Guidelines
- Prefer [shadcn/ui](https://ui.shadcn.com/) components whenever they fit the requirement.
- Before building a UI component from scratch, check whether an appropriate shadcn/ui component already exists.
- Use shadcn/ui for common interface elements such as buttons, dialogs, dropdowns, tooltips, inputs, selects, tables, and cards.
- Customize shadcn/ui components to match the application's design rather than using their defaults blindly.
- Build custom components when shadcn/ui does not provide a suitable solution, especially for domain-specific components such as the weekly roster and shift visualization.
- Maintain consistent spacing, typography, colors, and interaction patterns across the application.
- Avoid introducing another UI component library without a good reason.

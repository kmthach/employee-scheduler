import type { Assignment, Staff } from "./types"

export interface StaffInput {
  name: string
  maxWeeklyHours: number
}

export interface StaffValidation {
  ok: boolean
  errors: { name?: string; maxWeeklyHours?: string }
}

export const MAX_NAME_LENGTH = 60
export const MAX_HOURS_PER_WEEK = 168

export function validateStaffInput(input: StaffInput): StaffValidation {
  const errors: StaffValidation["errors"] = {}
  const name = input.name.trim()
  if (!name) errors.name = "Name is required."
  else if (name.length > MAX_NAME_LENGTH)
    errors.name = `Name must be ${MAX_NAME_LENGTH} characters or fewer.`

  const hours = input.maxWeeklyHours
  if (!Number.isFinite(hours) || hours <= 0 || hours > MAX_HOURS_PER_WEEK)
    errors.maxWeeklyHours = `Enter hours greater than 0 and up to ${MAX_HOURS_PER_WEEK}.`

  return { ok: Object.keys(errors).length === 0, errors }
}

export function addStaff(staff: Staff[], scheduleId: string, input: StaffInput, id: string): Staff[] {
  return [...staff, { id, scheduleId, name: input.name.trim(), maxWeeklyHours: input.maxWeeklyHours }]
}

export function addStaffBatch(
  staff: Staff[],
  scheduleId: string,
  inputs: StaffInput[],
  newId: () => string
): Staff[] {
  return inputs.reduce((acc, input) => addStaff(acc, scheduleId, input, newId()), staff)
}

export interface StaffRowDraft {
  name: string
  maxWeeklyHours: number
}

export interface StaffBatchValidation {
  ok: boolean
  /** Valid inputs, with blank rows skipped. Only meaningful when `ok`. */
  inputs: StaffInput[]
  /** Errors by row index; undefined for rows without errors or skipped blank rows. */
  errors: (StaffValidation["errors"] | undefined)[]
}

/** Rows with a blank name are skipped. Any error in a non-blank row rejects the whole batch. */
export function validateStaffBatch(rows: StaffRowDraft[]): StaffBatchValidation {
  const errors: StaffBatchValidation["errors"] = rows.map(() => undefined)
  const inputs: StaffInput[] = []
  let ok = true

  rows.forEach((row, i) => {
    if (row.name.trim() === "") return
    const result = validateStaffInput(row)
    if (result.ok) inputs.push(row)
    else {
      ok = false
      errors[i] = result.errors
    }
  })

  if (ok && inputs.length === 0) {
    ok = false
    if (rows.length > 0) errors[0] = { name: "Name is required." }
  }
  return { ok, inputs, errors }
}

export function updateStaff(staff: Staff[], id: string, input: StaffInput): Staff[] {
  return staff.map((s) =>
    s.id === id ? { ...s, name: input.name.trim(), maxWeeklyHours: input.maxWeeklyHours } : s
  )
}

/** Removes an employee and all of their assignments. */
export function removeStaff(
  staff: Staff[],
  assignments: Assignment[],
  id: string
): { staff: Staff[]; assignments: Assignment[] } {
  return {
    staff: staff.filter((s) => s.id !== id),
    assignments: assignments.filter((a) => a.staffId !== id),
  }
}

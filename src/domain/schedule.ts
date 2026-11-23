import { getScheduleId, parseScheduleId } from "./date"
import type { ShiftInput } from "./shift"
import type { StaffInput } from "./staff"
import type { TransactionCell } from "./transactions"
import type {
  Assignment,
  Schedule,
  ScheduleContent,
  Shift,
  Staff,
  TransactionRecord,
} from "./types"

export const DEFAULT_SHIFT_TIMES = [
  { startTime: "07:00", endTime: "15:00" },
  { startTime: "15:00", endTime: "23:00" },
] as const

/** True if the ID is a valid `YYYY-MM-DD` date that falls on a Monday. */
export function isValidScheduleId(id: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(id)) return false
  return getScheduleId(parseScheduleId(id)) === id
}

/** Where a transaction dataset came from (the store adds `savedAt`). */
export interface TransactionSource {
  fileName: string | null
  reportRange?: string
}

/** What a new schedule starts with; edited in the New schedule dialog. */
export interface NewScheduleSetup {
  shifts: ShiftInput[]
  staff: StaffInput[]
  transactions: TransactionCell[]
  transactionSource?: TransactionSource
}

/**
 * The latest schedule strictly before `targetId`: the source for pre-filling or copying a new
 * week. Ids are ISO dates, so string order is chronological. Null for the earliest week.
 */
export function findSourceScheduleId(
  scheduleIds: string[],
  targetId: string
): string | null {
  const earlier = scheduleIds.filter((id) => id < targetId).sort()
  return earlier.length > 0 ? earlier[earlier.length - 1] : null
}

/** First schedule: the default shifts only. */
export function getDefaultSetup(): NewScheduleSetup {
  return {
    shifts: DEFAULT_SHIFT_TIMES.map((t) => ({ ...t })),
    staff: [],
    transactions: [],
  }
}

/**
 * Pre-filled setup from the source schedule's rows: its shift times, employees (name and
 * maximum hours, no assignments) and transactions.
 */
export function getSetupFromSource(
  source: ScheduleContent & {
    transactions: TransactionRecord[]
    transactionSource?: TransactionSource
  }
): NewScheduleSetup {
  return {
    shifts: source.shifts.map((s) => ({
      startTime: s.startTime,
      endTime: s.endTime,
    })),
    staff: source.staff.map((s) => ({
      name: s.name,
      maxWeeklyHours: s.maxWeeklyHours,
    })),
    transactions: source.transactions.map((t) => ({
      dayOfWeek: t.dayOfWeek,
      hour: t.hour,
      transactionCount: t.transactionCount,
    })),
    transactionSource: source.transactionSource,
  }
}

/** Creates a draft schedule with its shifts, employees and transactions (defaults if no setup). */
export function createSchedule(
  scheduleId: string,
  now: Date,
  newId: () => string,
  setup: NewScheduleSetup = getDefaultSetup()
): {
  schedule: Schedule
  shifts: Shift[]
  staff: Staff[]
  transactions: TransactionRecord[]
} {
  if (!isValidScheduleId(scheduleId)) {
    throw new Error(`Invalid schedule ID: ${scheduleId}`)
  }
  const timestamp = now.toISOString()
  return {
    schedule: { id: scheduleId, status: "draft", createdAt: timestamp, updatedAt: timestamp },
    shifts: setup.shifts.map((t) => ({
      id: newId(),
      scheduleId,
      startTime: t.startTime,
      endTime: t.endTime,
    })),
    staff: setup.staff.map((s) => ({
      id: newId(),
      scheduleId,
      name: s.name.trim(),
      maxWeeklyHours: s.maxWeeklyHours,
    })),
    transactions: setup.transactions.map((c) => ({
      id: newId(),
      scheduleId,
      ...c,
    })),
  }
}

/**
 * Clones a schedule's rows into another week with fresh ids. Assignments are remapped to the
 * cloned employees and shifts, so the copy is fully independent of the source.
 */
export function copyScheduleContent(
  source: ScheduleContent & { transactions: TransactionRecord[] },
  targetId: string,
  newId: () => string
): ScheduleContent & { transactions: TransactionRecord[] } {
  const staffIds = new Map<string, string>()
  const shiftIds = new Map<string, string>()
  const staff: Staff[] = source.staff.map((s) => {
    const id = newId()
    staffIds.set(s.id, id)
    return { ...s, id, scheduleId: targetId }
  })
  const shifts: Shift[] = source.shifts.map((s) => {
    const id = newId()
    shiftIds.set(s.id, id)
    return { ...s, id, scheduleId: targetId }
  })
  const assignments: Assignment[] = source.assignments.flatMap((a) => {
    const staffId = staffIds.get(a.staffId)
    const shiftId = shiftIds.get(a.shiftId)
    return staffId && shiftId
      ? [{ ...a, id: newId(), scheduleId: targetId, staffId, shiftId }]
      : []
  })
  const transactions: TransactionRecord[] = source.transactions.map((t) => ({
    ...t,
    id: newId(),
    scheduleId: targetId,
  }))
  return { staff, shifts, assignments, transactions }
}

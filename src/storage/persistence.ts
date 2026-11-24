import { parseTime } from "@/domain/time"
import type {
  Assignment,
  Schedule,
  ScheduleContent,
  Shift,
  Staff,
  TransactionRecord,
} from "@/domain/types"

import { clearAll, getItem, removeItem, setItem } from "./idb"

export const SCHEMA_VERSION = 1
const STATE_KEY = "state"
const BACKUP_KEY = "state-corrupt-backup"

export interface PersistedReport {
  fileName: string | null
  reportRange?: string
  savedAt: string
}

/** The store data that survives a refresh. Undo history and the viewed week are session-only. */
export interface PersistedData {
  schedules: Schedule[]
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
  publishedSnapshots: Record<string, ScheduleContent>
  autoRemovedKeys: Record<string, string[]>
  transactionsPerStaffHour: Record<string, number>
  transactions: TransactionRecord[]
  transactionReports: Record<string, PersistedReport>
}

export type LoadResult =
  | { status: "empty" }
  | { status: "ok"; data: PersistedData }
  | { status: "corrupt" }
  | { status: "error" }

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v)
const isStr = (v: unknown): v is string => typeof v === "string"
const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v)
const isDay = (v: unknown) =>
  Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6
const isArr = <T>(v: unknown, ok: (x: unknown) => x is T): v is T[] =>
  Array.isArray(v) && v.every(ok)
const isRecord = <T>(
  v: unknown,
  ok: (x: unknown) => x is T
): v is Record<string, T> => isObj(v) && Object.values(v).every(ok)

const isSchedule = (v: unknown): v is Schedule =>
  isObj(v) &&
  isStr(v.id) &&
  (v.status === "draft" || v.status === "published") &&
  isStr(v.createdAt) &&
  isStr(v.updatedAt)
const isStaff = (v: unknown): v is Staff =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.scheduleId) &&
  isStr(v.name) &&
  isNum(v.maxWeeklyHours) &&
  v.maxWeeklyHours >= 0
const isShift = (v: unknown): v is Shift =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.scheduleId) &&
  isStr(v.startTime) &&
  parseTime(v.startTime) !== null &&
  isStr(v.endTime) &&
  parseTime(v.endTime) !== null
const isAssignment = (v: unknown): v is Assignment =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.scheduleId) &&
  isStr(v.staffId) &&
  isStr(v.shiftId) &&
  isDay(v.dayOfWeek)
const isTransaction = (v: unknown): v is TransactionRecord =>
  isObj(v) &&
  isStr(v.id) &&
  isStr(v.scheduleId) &&
  isDay(v.dayOfWeek) &&
  Number.isInteger(v.hour) &&
  (v.hour as number) >= 0 &&
  (v.hour as number) <= 23 &&
  isNum(v.transactionCount) &&
  v.transactionCount >= 0
const isContent = (v: unknown): v is ScheduleContent =>
  isObj(v) &&
  isArr(v.staff, isStaff) &&
  isArr(v.shifts, isShift) &&
  isArr(v.assignments, isAssignment)
const isReport = (v: unknown): v is PersistedReport =>
  isObj(v) &&
  (v.fileName === null || isStr(v.fileName)) &&
  (v.reportRange === undefined || isStr(v.reportRange)) &&
  isStr(v.savedAt)

/** Every assignment must point at an existing employee and shift of its own schedule. */
function assignmentsAreConsistent(
  staff: Staff[],
  shifts: Shift[],
  assignments: Assignment[]
): boolean {
  const staffSchedule = new Map(staff.map((s) => [s.id, s.scheduleId]))
  const shiftSchedule = new Map(shifts.map((s) => [s.id, s.scheduleId]))
  return assignments.every(
    (a) =>
      staffSchedule.get(a.staffId) === a.scheduleId &&
      shiftSchedule.get(a.shiftId) === a.scheduleId
  )
}

export function serialize(data: PersistedData): unknown {
  return { version: SCHEMA_VERSION, data }
}

/** Validates a stored record. Returns null for anything malformed, unknown or inconsistent. */
export function parseStored(raw: unknown): PersistedData | null {
  if (!isObj(raw) || raw.version !== SCHEMA_VERSION || !isObj(raw.data)) {
    return null
  }
  const d = raw.data
  if (
    !isArr(d.schedules, isSchedule) ||
    !isArr(d.staff, isStaff) ||
    !isArr(d.shifts, isShift) ||
    !isArr(d.assignments, isAssignment) ||
    !isRecord(d.publishedSnapshots, isContent) ||
    !isRecord(d.autoRemovedKeys, (x): x is string[] => isArr(x, isStr)) ||
    !isRecord(d.transactionsPerStaffHour, isNum) ||
    !isArr(d.transactions, isTransaction) ||
    !isRecord(d.transactionReports, isReport)
  ) {
    return null
  }
  const ids = new Set(d.schedules.map((s) => s.id))
  if (ids.size !== d.schedules.length) return null
  const owned = [...d.staff, ...d.shifts, ...d.assignments, ...d.transactions]
  if (!owned.every((row) => ids.has(row.scheduleId))) return null
  if (!assignmentsAreConsistent(d.staff, d.shifts, d.assignments)) return null
  return d as unknown as PersistedData
}

export async function loadState(): Promise<LoadResult> {
  let raw: unknown
  try {
    raw = await getItem(STATE_KEY)
  } catch {
    return { status: "error" }
  }
  if (raw === undefined) return { status: "empty" }
  const data = parseStored(raw)
  if (data) return { status: "ok", data }
  try {
    // Keep the unreadable payload aside instead of silently destroying it.
    await setItem(BACKUP_KEY, raw)
    await removeItem(STATE_KEY)
  } catch {
    /* best effort */
  }
  return { status: "corrupt" }
}

/** Writes the whole state as one record, so a save is all-or-nothing. */
export async function saveState(data: PersistedData): Promise<void> {
  await setItem(STATE_KEY, serialize(data))
}

export async function clearState(): Promise<void> {
  await clearAll()
}

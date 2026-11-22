import { formatDate, getWeekDays } from "./date"
import { DAYS_OF_WEEK } from "./types"
import type { DayOfWeek, TransactionRecord } from "./types"

export interface TransactionCell {
  dayOfWeek: DayOfWeek
  hour: number
  transactionCount: number
}

export type ParseResult =
  | {
      ok: true
      cells: TransactionCell[]
      reportRange?: string
      warnings: string[]
    }
  | { ok: false; errors: string[] }

/** The template ships with a single example row; users add more hour rows in the CSV. */
export const TEMPLATE_HOURS: number[] = [8]

const WEEKDAY_PREFIXES = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]

export function parseWeekdayLabel(label: string): DayOfWeek | null {
  const prefix = label.trim().slice(0, 3).toLowerCase()
  const index = WEEKDAY_PREFIXES.indexOf(prefix)
  return index === -1 ? null : (index as DayOfWeek)
}

/** Accepts "7am", "12 PM" or 24-hour "07:00"; returns 0–23 or null. */
export function parseHourLabel(label: string): number | null {
  const text = label.trim().toLowerCase()
  const twelve = /^(\d{1,2})\s*(am|pm)$/.exec(text)
  if (twelve) {
    const h = Number(twelve[1])
    if (h < 1 || h > 12) return null
    return (h % 12) + (twelve[2] === "pm" ? 12 : 0)
  }
  const twentyFour = /^(\d{1,2}):00$/.exec(text)
  if (twentyFour && Number(twentyFour[1]) <= 23) return Number(twentyFour[1])
  return null
}

export function formatHour(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${hour < 12 ? "am" : "pm"}`
}

/** A non-negative whole number written with digits only. */
export function parseCount(text: string): number | null {
  const t = text.trim()
  return /^\d+$/.test(t) ? Number(t) : null
}

const MAX_ERRORS = 10

function capErrors(errors: string[]): string[] {
  if (errors.length <= MAX_ERRORS) return errors
  return [
    ...errors.slice(0, MAX_ERRORS),
    `…and ${errors.length - MAX_ERRORS} more problems.`,
  ]
}

/**
 * Interprets tokenized CSV rows: optional title row(s), a header of weekday names
 * (any order, each exactly once), then one row per hour. Never throws.
 */
export function parseTransactionRows(input: string[][]): ParseResult {
  const rows = input.filter((r) => r.some((c) => c.trim() !== ""))
  if (rows.length === 0) return { ok: false, errors: ["The file is empty."] }

  const warnings: string[] = []
  let reportRange: string | undefined
  // Rows before the header are title rows. A title like `Aug 07, 2026 - Aug 13, 2026` may be
  // split across cells by an unquoted comma, so the header is the first row with a weekday name.
  const isHeader = (row: string[]) =>
    row.slice(1).some((c) => parseWeekdayLabel(c) !== null)
  let headerIndex = rows.findIndex(isHeader)
  if (headerIndex === -1) headerIndex = rows.length
  if (headerIndex > 0)
    reportRange = rows[0]
      .map((c) => c.trim())
      .filter(Boolean)
      .join(", ")
  if (headerIndex === rows.length)
    return {
      ok: false,
      errors: ["No header row with weekday names was found."],
    }
  if (headerIndex === 0) warnings.push("No report title row found.")

  const header = rows[headerIndex]
  const errors: string[] = []
  const columnDays: DayOfWeek[] = []
  const seenDays = new Set<DayOfWeek>()
  for (let c = 1; c < header.length; c++) {
    const label = header[c].trim()
    if (label === "") continue
    const day = parseWeekdayLabel(label)
    if (day === null) {
      errors.push(`Header column "${label}" is not a weekday name.`)
    } else if (seenDays.has(day)) {
      errors.push(
        `Weekday ${DAYS_OF_WEEK[day]} appears more than once in the header.`
      )
    } else {
      seenDays.add(day)
    }
    columnDays[c] = day as DayOfWeek
  }
  if (errors.length === 0 && seenDays.size !== 7) {
    const missing = DAYS_OF_WEEK.filter((_, i) => !seenDays.has(i as DayOfWeek))
    errors.push(`Expected 7 weekday columns; missing ${missing.join(", ")}.`)
  }
  if (errors.length > 0) return { ok: false, errors: capErrors(errors) }

  const dataRows = rows.slice(headerIndex + 1)
  if (dataRows.length === 0)
    return { ok: false, errors: ["The file has no hourly rows."] }

  const cells: TransactionCell[] = []
  const seenHours = new Set<number>()
  for (const row of dataRows) {
    const rowLabel = row[0]?.trim() ?? ""
    const hour = parseHourLabel(rowLabel)
    if (hour === null) {
      errors.push(
        `Row "${rowLabel}": not a recognizable hour (e.g. 7am or 13:00).`
      )
      continue
    }
    if (seenHours.has(hour)) {
      errors.push(`Row "${rowLabel}": hour appears more than once.`)
      continue
    }
    seenHours.add(hour)
    if (row.length !== header.length) {
      errors.push(
        `Row "${rowLabel}": expected ${header.length - 1} values but found ${row.length - 1}.`
      )
      continue
    }
    for (let c = 1; c < header.length; c++) {
      if (header[c].trim() === "") continue
      const count = parseCount(row[c])
      if (count === null) {
        errors.push(
          `Row "${rowLabel}", column "${header[c].trim()}": "${row[c].trim()}" is not a non-negative whole number.`
        )
      } else {
        cells.push({ dayOfWeek: columnDays[c], hour, transactionCount: count })
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors: capErrors(errors) }
  return { ok: true, cells, reportRange, warnings }
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

/** Column header for a day, in the sample report's style: "Mon, 10 Aug". */
export function formatDayHeader(date: Date): string {
  const weekday = DAYS_OF_WEEK[(date.getDay() + 6) % 7].slice(0, 3)
  return `${weekday}, ${String(date.getDate()).padStart(2, "0")} ${MONTHS[date.getMonth()]}`
}

/** Schedule duration in the sample report's style: "Aug 10, 2026 - Aug 16, 2026". */
export function formatReportRange(scheduleId: string): string {
  const days = getWeekDays(scheduleId)
  const f = (d: Date) =>
    `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")}, ${d.getFullYear()}`
  return `${f(days[0])} - ${f(days[6])}`
}

const csvCell = (text: string) => (text.includes(",") ? `"${text}"` : text)

/**
 * Template in the same layout as the supplied sample report (BOM, CRLF, title row with the
 * date range, dated weekday header, one row per hour) for the given schedule week.
 */
export function buildTemplateCsv(
  scheduleId: string,
  hours: number[] = TEMPLATE_HOURS
): string {
  return buildTransactionCsv(scheduleId, {}, hours)
}

/** Exports grid values in the template layout; blank or invalid cells are written as 0. */
export function buildTransactionCsv(
  scheduleId: string,
  values: GridValues,
  hours: number[] = gridHours(values)
): string {
  const days = getWeekDays(scheduleId)
  const lines = [
    csvCell(formatReportRange(scheduleId)),
    ["", ...days.map((d) => csvCell(formatDayHeader(d)))].join(","),
    ...hours.map((h) =>
      [
        formatHour(h),
        ...days.map((_, d) => parseCount(values[cellKey(d, h)] ?? "") ?? 0),
      ].join(",")
    ),
  ]
  return "\uFEFF" + lines.join("\r\n")
}

export function buildTransactionRecords(
  scheduleId: string,
  cells: TransactionCell[],
  makeId: () => string
): TransactionRecord[] {
  return cells.map((c) => ({ id: makeId(), scheduleId, ...c }))
}

export function cellKey(dayOfWeek: number, hour: number): string {
  return `${dayOfWeek}-${hour}`
}

/** Grid state as editable text, keyed by cellKey. */
export type GridValues = Record<string, string>

export function recordsToGrid(
  records: Pick<TransactionRecord, "dayOfWeek" | "hour" | "transactionCount">[]
): GridValues {
  return Object.fromEntries(
    records.map((r) => [
      cellKey(r.dayOfWeek, r.hour),
      String(r.transactionCount),
    ])
  )
}

/** Hours present in the data, sorted. */
export function gridHours(values: GridValues): number[] {
  const hours = new Set(
    Object.keys(values).map((key) => Number(key.split("-")[1]))
  )
  return [...hours].sort((a, b) => a - b)
}

export function gridToCells(values: GridValues): TransactionCell[] {
  return Object.entries(values).map(([key, text]) => {
    const [day, hour] = key.split("-").map(Number)
    return {
      dayOfWeek: day as DayOfWeek,
      hour,
      transactionCount: Number(text),
    }
  })
}

export function sumCells(
  cells: Pick<TransactionCell, "transactionCount">[]
): number {
  return cells.reduce((sum, c) => sum + c.transactionCount, 0)
}

/** Export file name carrying the week's start and end dates (Monday and Sunday). */
export function exportFileName(scheduleId: string): string {
  const days = getWeekDays(scheduleId)
  return `transactions_${formatDate(days[0])}_${formatDate(days[6])}.csv`
}

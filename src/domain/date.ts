const DAYS_PER_WEEK = 7

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

/** Formats a local date as YYYY-MM-DD (never uses UTC). */
export function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Returns local midnight of the Monday of the week containing `date`. */
export function getMonday(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const daysSinceMonday = (monday.getDay() + 6) % 7
  monday.setDate(monday.getDate() - daysSinceMonday)
  return monday
}

export function getScheduleId(date: Date): string {
  return formatDate(getMonday(date))
}

export function parseScheduleId(scheduleId: string): Date {
  const [y, m, d] = scheduleId.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function moveWeek(scheduleId: string, offset: number): string {
  const date = parseScheduleId(scheduleId)
  date.setDate(date.getDate() + offset * DAYS_PER_WEEK)
  return formatDate(date)
}

/** Whether `date` falls on the same local calendar day as `now`. */
export function isToday(date: Date, now: Date = new Date()): boolean {
  return formatDate(date) === formatDate(now)
}

/** The seven dates (Monday–Sunday) of the schedule week. */
export function getWeekDays(scheduleId: string): Date[] {
  const start = parseScheduleId(scheduleId)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export function formatWeekRange(scheduleId: string): string {
  const days = getWeekDays(scheduleId)
  const start = days[0]
  const end = days[6]
  const short: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const startText = start.toLocaleDateString("en-US", short)
  const endText = end.toLocaleDateString("en-US", short)
  return `${startText} – ${endText}, ${end.getFullYear()}`
}

/**
 * Week ids offered in the week dropdown: `radius` weeks either side of
 * `centerId`, plus every id in `extraIds` (e.g. existing schedules), sorted ascending.
 */
export function getWeekOptions(
  centerId: string,
  extraIds: string[] = [],
  radius = 8
): string[] {
  const ids = new Set(extraIds)
  for (let i = -radius; i <= radius; i++) ids.add(moveWeek(centerId, i))
  return [...ids].sort()
}

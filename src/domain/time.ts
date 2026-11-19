import type { Shift } from "./types"

/** Parses "HH:mm" into minutes since midnight, or null if invalid. */
export function parseTime(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

export function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** Shift length in hours; 0 if times are invalid or end is not after start. */
export function shiftDurationHours(shift: Pick<Shift, "startTime" | "endTime">): number {
  const start = parseTime(shift.startTime)
  const end = parseTime(shift.endTime)
  if (start === null || end === null || end <= start) return 0
  return (end - start) / 60
}

/** True if the two time ranges share any time. Touching boundaries (end == start) don't overlap. */
export function timesOverlap(
  a: Pick<Shift, "startTime" | "endTime">,
  b: Pick<Shift, "startTime" | "endTime">
): boolean {
  const aStart = parseTime(a.startTime)
  const aEnd = parseTime(a.endTime)
  const bStart = parseTime(b.startTime)
  const bEnd = parseTime(b.endTime)
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false
  return aStart < bEnd && bStart < aEnd
}

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

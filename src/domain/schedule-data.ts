/** Returns only the rows owned by the given schedule. */
export function filterBySchedule<T extends { scheduleId: string }>(
  items: T[],
  scheduleId: string
): T[] {
  return items.filter((item) => item.scheduleId === scheduleId)
}

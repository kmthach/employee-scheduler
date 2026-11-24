import { describe, expect, it } from "vitest"

import { filterBySchedule } from "./schedule-data"

describe("filterBySchedule", () => {
  const rows = [
    { id: "1", scheduleId: "2026-11-16" },
    { id: "2", scheduleId: "2026-11-23" },
    { id: "3", scheduleId: "2026-11-16" },
  ]
  it("returns only rows for the given schedule", () => {
    expect(filterBySchedule(rows, "2026-11-16").map((r) => r.id)).toEqual([
      "1",
      "3",
    ])
  })
  it("returns nothing for an unknown schedule", () => {
    expect(filterBySchedule(rows, "2026-11-30")).toEqual([])
  })
})

import { describe, expect, it } from "vitest"

import {
  getMonday,
  getScheduleId,
  getWeekDays,
  getWeekOptions,
  isToday,
  moveWeek,
} from "./date"

describe("isToday", () => {
  it("matches the same local day regardless of time", () => {
    const now = new Date(2026, 10, 23, 23, 59)
    expect(isToday(new Date(2026, 10, 23), now)).toBe(true)
    expect(isToday(new Date(2026, 10, 24), now)).toBe(false)
    expect(isToday(new Date(2025, 10, 23), now)).toBe(false)
  })
})

describe("getMonday", () => {
  it("returns the same day for a Monday", () => {
    expect(getScheduleId(new Date(2026, 10, 16))).toBe("2026-11-16")
  })
  it("returns the previous Monday for a Sunday", () => {
    expect(getScheduleId(new Date(2026, 10, 22, 23, 59))).toBe("2026-11-16")
  })
  it("handles mid-week and month boundaries", () => {
    expect(getScheduleId(new Date(2026, 11, 2))).toBe("2026-11-30")
  })
  it("handles year boundaries", () => {
    expect(getScheduleId(new Date(2027, 0, 1))).toBe("2026-12-28")
  })
  it("returns local midnight", () => {
    const m = getMonday(new Date(2026, 10, 19, 15, 30))
    expect([m.getHours(), m.getMinutes()]).toEqual([0, 0])
  })
})

describe("moveWeek", () => {
  it("moves forward and back by seven days", () => {
    expect(moveWeek("2026-11-16", 1)).toBe("2026-11-23")
    expect(moveWeek("2026-11-16", -1)).toBe("2026-11-09")
  })
  it("crosses year boundaries", () => {
    expect(moveWeek("2026-12-28", 1)).toBe("2027-01-04")
  })
  it("is DST-safe", () => {
    expect(moveWeek("2026-03-02", 1)).toBe("2026-03-09")
    expect(moveWeek("2026-10-26", 1)).toBe("2026-11-02")
  })
  it("round-trips", () => {
    expect(moveWeek(moveWeek("2026-11-16", 5), -5)).toBe("2026-11-16")
  })
})

describe("getWeekDays", () => {
  it("returns Monday through Sunday", () => {
    const days = getWeekDays("2026-11-16")
    expect(days).toHaveLength(7)
    expect(days[0].getDay()).toBe(1)
    expect(days[6].getDay()).toBe(0)
  })
})

describe("getWeekOptions", () => {
  it("returns a sorted window around the center including extra ids", () => {
    const options = getWeekOptions("2026-11-16", ["2025-01-06"], 2)
    expect(options).toEqual([
      "2025-01-06",
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
      "2026-11-23",
      "2026-11-30",
    ])
  })

  it("does not duplicate ids already in the window", () => {
    expect(getWeekOptions("2026-11-16", ["2026-11-23"], 1)).toHaveLength(3)
  })
})

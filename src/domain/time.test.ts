import { describe, expect, it } from "vitest"

import { formatTime, parseTime, shiftDurationHours } from "./time"

describe("parseTime", () => {
  it("parses valid times", () => {
    expect(parseTime("00:00")).toBe(0)
    expect(parseTime("07:30")).toBe(450)
    expect(parseTime("23:59")).toBe(1439)
  })
  it("rejects invalid times", () => {
    for (const t of ["24:00", "7:00", "12:60", "", "abc", "12:5"]) {
      expect(parseTime(t)).toBeNull()
    }
  })
})

describe("formatTime", () => {
  it("round-trips", () => {
    expect(formatTime(450)).toBe("07:30")
    expect(formatTime(parseTime("15:00")!)).toBe("15:00")
  })
})

describe("shiftDurationHours", () => {
  it("computes whole and half hours", () => {
    expect(shiftDurationHours({ startTime: "07:00", endTime: "15:00" })).toBe(8)
    expect(shiftDurationHours({ startTime: "09:00", endTime: "12:30" })).toBe(3.5)
  })
  it("returns 0 for invalid or non-positive shifts", () => {
    expect(shiftDurationHours({ startTime: "15:00", endTime: "07:00" })).toBe(0)
    expect(shiftDurationHours({ startTime: "10:00", endTime: "10:00" })).toBe(0)
    expect(shiftDurationHours({ startTime: "xx", endTime: "10:00" })).toBe(0)
  })
})

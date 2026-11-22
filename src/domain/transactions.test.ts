import { describe, expect, it } from "vitest"

import {
  buildTemplateCsv,
  buildTransactionCsv,
  exportFileName,
  formatDayHeader,
  formatReportRange,
  buildTransactionRecords,
  gridHours,
  gridToCells,
  parseHourLabel,
  parseTransactionRows,
  recordsToGrid,
  sumCells,
} from "./transactions"

const sampleRows = [
  ["Aug 07, 2026 - Aug 13, 2026"],
  [
    "",
    "Fri, 07 Aug",
    "Sat, 08 Aug",
    "Sun, 09 Aug",
    "Mon, 10 Aug",
    "Tue, 11 Aug",
    "Wed, 12 Aug",
    "Thu, 13 Aug",
  ],
  ["7am", "22", "13", "7", "12", "22", "13", "16"],
  ["12pm", "25", "47", "30", "33", "52", "33", "40"],
  ["10pm", "5", "5", "6", "7", "2", "6", "6"],
]

function ok(rows: string[][]) {
  const r = parseTransactionRows(rows)
  if (!r.ok) throw new Error(r.errors.join("; "))
  return r
}
const count = (r: ReturnType<typeof ok>, day: number, hour: number) =>
  r.cells.find((c) => c.dayOfWeek === day && c.hour === hour)?.transactionCount

describe("parseHourLabel", () => {
  it("handles 12-hour and 24-hour labels", () => {
    expect(parseHourLabel("7am")).toBe(7)
    expect(parseHourLabel("12pm")).toBe(12)
    expect(parseHourLabel("12AM")).toBe(0)
    expect(parseHourLabel("10 pm")).toBe(22)
    expect(parseHourLabel("13:00")).toBe(13)
    expect(parseHourLabel("13pm")).toBeNull()
    expect(parseHourLabel("noon")).toBeNull()
  })
})

describe("parseTransactionRows", () => {
  it("maps Friday-first columns to Monday-based days", () => {
    const r = ok(sampleRows)
    expect(r.reportRange).toBe("Aug 07, 2026 - Aug 13, 2026")
    expect(r.cells).toHaveLength(21)
    expect(count(r, 0, 7)).toBe(12) // Monday 7am
    expect(count(r, 4, 7)).toBe(22) // Friday 7am
    expect(count(r, 6, 22)).toBe(6) // Sunday 10pm
    expect(count(r, 1, 12)).toBe(52) // Tuesday noon
  })

  it("accepts a title split across cells by an unquoted comma", () => {
    const r = ok([
      ["Nov 16", " 2026 - Nov 22", " 2026"],
      ...sampleRows.slice(1),
    ])
    expect(r.reportRange).toBe("Nov 16, 2026 - Nov 22, 2026")
    expect(r.cells).toHaveLength(21)
  })

  it("works without a title row", () => {
    const r = ok(sampleRows.slice(1))
    expect(r.reportRange).toBeUndefined()
    expect(r.warnings.length).toBe(1)
  })

  it("ignores blank rows", () => {
    expect(ok([...sampleRows, [""], []]).cells).toHaveLength(21)
  })

  const fails = (rows: string[][]) => {
    const r = parseTransactionRows(rows)
    if (r.ok) throw new Error("expected failure")
    return r.errors.join("\n")
  }

  it("rejects empty input", () => {
    expect(fails([])).toMatch(/empty/)
  })
  it("rejects missing weekday columns", () => {
    const rows = sampleRows.map((r) => r.slice(0, 7))
    expect(fails(rows)).toMatch(/missing Thursday/)
  })
  it("rejects duplicate weekday and unknown header", () => {
    const dup = sampleRows.map((r) => [...r])
    dup[1][2] = "Fri again"
    expect(fails(dup)).toMatch(/more than once/)
    const bad = sampleRows.map((r) => [...r])
    bad[1][2] = "Foo"
    expect(fails(bad)).toMatch(/not a weekday/)
  })
  it("rejects bad cells with row and column", () => {
    for (const bad of ["abc", "-3", "1.5", ""]) {
      const rows = sampleRows.map((r) => [...r])
      rows[3][2] = bad
      expect(fails(rows)).toMatch(/Row "12pm", column "Sat, 08 Aug"/)
    }
  })
  it("rejects duplicate hours, unknown hours and wrong cell counts", () => {
    expect(fails([...sampleRows, sampleRows[2]])).toMatch(/more than once/)
    expect(fails([...sampleRows, ["lunch", ...Array(7).fill("1")]])).toMatch(
      /recognizable hour/
    )
    expect(fails([...sampleRows, ["11pm", "1", "2"]])).toMatch(
      /expected 7 values/
    )
  })
  it("rejects a file with no hourly rows", () => {
    expect(fails(sampleRows.slice(0, 2))).toMatch(/no hourly rows/)
  })
})

describe("template and grid helpers", () => {
  it("template follows the sample layout for the schedule week", () => {
    const lines = buildTemplateCsv("2026-08-10").split("\r\n")
    expect(lines[0]).toBe('\uFEFF"Aug 10, 2026 - Aug 16, 2026"')
    expect(lines[1]).toBe(
      ',"Mon, 10 Aug","Tue, 11 Aug","Wed, 12 Aug","Thu, 13 Aug","Fri, 14 Aug","Sat, 15 Aug","Sun, 16 Aug"'
    )
    expect(lines[2]).toBe("8am,0,0,0,0,0,0,0")
    expect(lines).toHaveLength(3)
  })

  it("formats day headers and ranges like the sample", () => {
    expect(formatDayHeader(new Date(2026, 7, 7))).toBe("Fri, 07 Aug")
    expect(formatReportRange("2026-08-03")).toBe("Aug 03, 2026 - Aug 09, 2026")
  })

  it("builds records and grid values", () => {
    const r = ok(sampleRows)
    const records = buildTransactionRecords("2026-08-10", r.cells, () => "id")
    expect(records[0]).toMatchObject({ scheduleId: "2026-08-10", id: "id" })
    const grid = recordsToGrid(records)
    expect(grid["0-7"]).toBe("12")
    expect(sumCells(gridToCells(grid))).toBe(sumCells(r.cells))
  })

  it("exports grid values in the template layout", () => {
    const csv = buildTransactionCsv(
      "2026-08-10",
      { "0-7": "12", "6-23": "4" },
      [7, 23]
    )
    const lines = csv.split("\r\n")
    expect(lines[2]).toBe("7am,12,0,0,0,0,0,0")
    expect(lines[3]).toBe("11pm,0,0,0,0,0,0,4")
    expect(
      buildTransactionCsv("2026-08-10", { "0-5": "1" }).split("\r\n")
    ).toHaveLength(3)
  })

  it("lists only the hours present in the data, sorted", () => {
    expect(gridHours({})).toEqual([])
    expect(gridHours({ "0-23": "1", "3-5": "1", "1-5": "2" })).toEqual([5, 23])
  })

  it("names the export after the week's start and end dates", () => {
    expect(exportFileName("2026-11-16")).toBe(
      "transactions_2026-11-16_2026-11-22.csv"
    )
    expect(exportFileName("2026-12-28")).toBe(
      "transactions_2026-12-28_2027-01-03.csv"
    )
  })
})

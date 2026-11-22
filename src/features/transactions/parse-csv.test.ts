import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { buildTemplateCsv, sumCells } from "@/domain/transactions"

import { parseTransactionCsv } from "./parse-csv"

describe("parseTransactionCsv", () => {
  it("imports the supplied sample (BOM, CRLF, title row)", () => {
    const text = readFileSync("sample_transaction_interview.csv", "utf8")
    const r = parseTransactionCsv(text)
    if (!r.ok) throw new Error(r.errors.join("; "))
    expect(r.cells).toHaveLength(16 * 7)
    expect(r.reportRange).toBe("Aug 07, 2026 - Aug 13, 2026")
    const at = (d: number, h: number) =>
      r.cells.find((c) => c.dayOfWeek === d && c.hour === h)?.transactionCount
    expect(at(0, 7)).toBe(12) // Mon 7am
    expect(at(4, 13)).toBe(64) // Fri 1pm
    expect(at(6, 22)).toBe(6) // Sun 10pm
    expect(sumCells(r.cells)).toBeGreaterThan(0)
  })

  it("accepts its own template", () => {
    const r = parseTransactionCsv(buildTemplateCsv("2026-08-10"))
    if (!r.ok) throw new Error(r.errors.join("; "))
    expect(r.cells).toHaveLength(7)
    expect(r.reportRange).toBe("Aug 10, 2026 - Aug 16, 2026")
    expect(sumCells(r.cells)).toBe(0)
  })

  it("recovers a header line re-saved as one quoted cell", () => {
    const days = [
      "Mon, 16 Nov",
      "Tue, 17 Nov",
      "Wed, 18 Nov",
      "Thu, 19 Nov",
      "Fri, 20 Nov",
      "Sat, 21 Nov",
      "Sun, 22 Nov",
    ]
    const wrapped = `"${["", ...days.map((d) => `"${d}"`)].join(",").replaceAll('"', '""')}"`
    const text = `Nov 16, 2026 - Nov 22, 2026\r\n${wrapped}\r\n7am,1,2,3,4,5,6,7\r\n`
    const r = parseTransactionCsv(text)
    if (!r.ok) throw new Error(r.errors.join("; "))
    expect(r.cells).toHaveLength(7)
    expect(r.reportRange).toBe("Nov 16, 2026 - Nov 22, 2026")
  })

  it("reports an empty file", () => {
    expect(parseTransactionCsv("").ok).toBe(false)
  })
})

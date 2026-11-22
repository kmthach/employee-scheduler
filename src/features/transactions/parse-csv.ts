import Papa from "papaparse"

import { parseTransactionRows } from "@/domain/transactions"
import type { ParseResult } from "@/domain/transactions"

const MAX_BYTES = 1_000_000

/** Reads an uploaded CSV file and validates it. Never throws. */
export async function parseTransactionFile(file: File): Promise<ParseResult> {
  const looksLikeCsv =
    file.name.toLowerCase().endsWith(".csv") || file.type.startsWith("text/")
  if (!looksLikeCsv)
    return { ok: false, errors: ["Please choose a .csv file."] }
  if (file.size > MAX_BYTES)
    return { ok: false, errors: ["The file is too large (limit 1 MB)."] }

  let text: string
  try {
    text = await file.text()
  } catch {
    return { ok: false, errors: ["The file could not be read."] }
  }
  return parseTransactionCsv(text)
}

export function parseTransactionCsv(text: string): ParseResult {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: "greedy",
  })
  // Field-count errors are expected (the title row has one cell) and are checked by the domain.
  const fatal = parsed.errors.find((e) => e.type !== "FieldMismatch")
  if (fatal)
    return {
      ok: false,
      errors: [`The file is not valid CSV: ${fatal.message}`],
    }
  return parseTransactionRows(parsed.data.map(unwrapQuotedLine))
}

/**
 * Some spreadsheet apps re-save a CSV with a whole line wrapped as one quoted cell
 * (e.g. `",""Mon, 16 Nov"",""Tue, 17 Nov"""`). Parse such a cell again as a line of its own.
 */
function unwrapQuotedLine(row: string[]): string[] {
  if (row.length !== 1 || !row[0].includes('"')) return row
  const inner = Papa.parse<string[]>(row[0]).data[0]
  return inner && inner.length > 1 ? inner : row
}

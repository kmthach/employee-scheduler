import { formatRatio } from "@/domain/coverage"
import type { DayCoverage } from "@/domain/coverage"
import { cn } from "@/lib/utils"

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`

const th = "bg-popover px-2 py-1.5 text-right font-medium text-muted-foreground"
const td = "px-2 py-1.5 text-right tabular-nums"

/** Hourly demand vs staffing for one day, with a day-total row. Shown in the day coverage drawer. */
export function DayCoverageTable({ day }: { day: DayCoverage }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 z-10">
        <tr className="border-b border-border/60">
          <th className={cn(th, "text-left")}>Hour</th>
          <th className={th} title="Transactions">
            Txn
          </th>
          <th className={th} title="Staff hours (employees working)">
            Staff
          </th>
          <th className={th} title="Transactions per staff hour">
            Ratio
          </th>
        </tr>
      </thead>
      <tbody>
        {day.rows.map((row) => (
          <tr
            key={row.hour}
            className={cn(
              "border-b border-border/40",
              row.shortfall > 0 && "bg-amber-50 dark:bg-amber-950/30"
            )}
          >
            <td className="px-2 py-1.5 font-medium">{hourLabel(row.hour)}</td>
            <td className={td}>{row.transactions.toLocaleString("en-US")}</td>
            <td
              className={cn(
                td,
                row.staffHours === 0 &&
                  row.transactions > 0 &&
                  "text-muted-foreground"
              )}
            >
              {row.staffHours}
              {row.shortfall > 0 && (
                <span
                  className="ml-1 font-medium text-amber-700 dark:text-amber-400"
                  title={`Needs ${row.required}, has ${row.staffHours}`}
                  aria-label={`Needs ${row.required}, has ${row.staffHours}`}
                >
                  -{row.shortfall}
                </span>
              )}
            </td>
            <td className={td}>{formatRatio(row.ratio)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="sticky bottom-0 z-10">
        <tr className="border-t border-border/60 font-semibold">
          <td className="bg-popover px-2 py-1.5">Total</td>
          <td className={cn(td, "bg-popover")}>
            {day.totals.transactions.toLocaleString("en-US")}
          </td>
          <td className={cn(td, "bg-popover")}>
            {day.totals.staffHours}
            {day.totals.shortfall > 0 && (
              <span
                className="ml-1 text-amber-700 dark:text-amber-400"
                title={`${day.totals.shortfall} understaffed hours`}
              >
                -{day.totals.shortfall}
              </span>
            )}
          </td>
          <td className={cn(td, "bg-popover")}>
            {formatRatio(day.totals.ratio)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

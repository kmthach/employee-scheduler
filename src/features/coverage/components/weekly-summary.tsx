import { formatRatio } from "@/domain/coverage"
import type { WeekSummary } from "@/domain/coverage"
import { cn } from "@/lib/utils"

interface Props {
  /** Null when the week has no transaction data (nothing is shown). */
  week: WeekSummary | null
}

const count = (n: number) => n.toLocaleString("en-US")

/** Slim KPI strip above the roster grid; hidden when there is no demand data. */
export function WeeklySummary({ week }: Props) {
  if (!week) return null
  const stats = [
    {
      label: "Transactions",
      value: count(week.totalTransactions),
      note: "All hours, Monday–Sunday",
    },
    {
      label: "Staff hours",
      value: `${count(week.totalStaffHours)}h`,
      note: "Employees working, summed over every hour",
    },
    {
      label: "Txn / staff hr",
      value: formatRatio(week.overallRatio),
      note: "Total transactions ÷ total staff hours (weekly productivity)",
    },
    {
      label: "Avg hourly ratio",
      value: formatRatio(week.averageHourlyRatio),
      note: "Mean of the hourly transactions per staff hour, staffed hours only",
    },
    {
      label: "Understaffed",
      value: `${count(week.understaffedHours)}h`,
      note: "Staff-hours short of the required staffing",
      warn: week.understaffedHours > 0,
    },
  ]
  return (
    <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
      {stats.map((s) => (
        <div key={s.label} className="flex items-baseline gap-2" title={s.note}>
          <dt className="text-xs text-muted-foreground">{s.label}</dt>
          <dd
            className={cn(
              "text-base font-semibold tabular-nums",
              s.warn && "text-amber-600 dark:text-amber-400"
            )}
          >
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

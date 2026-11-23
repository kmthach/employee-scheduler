import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRatio } from "@/domain/coverage"
import type { WeekCoverage } from "@/domain/coverage"
import { getWeekDays } from "@/domain/date"
import { DAYS_OF_WEEK } from "@/domain/types"
import { cn } from "@/lib/utils"

interface Props {
  scheduleId: string
  coverage: WeekCoverage
}

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`

/** Demand vs staffing for one selected day; the week is always computed in full. */
export function CoverageSection({ scheduleId, coverage }: Props) {
  const [selected, setSelected] = useState(0)
  const dates = getWeekDays(scheduleId)
  const day = coverage.days[selected]

  return (
    <section className="flex flex-col gap-3" aria-labelledby="coverage-title">
      <div>
        <h2 id="coverage-title" className="text-lg font-semibold">
          Daily coverage
        </h2>
        <p className="text-sm text-muted-foreground">
          Compare each hour's transactions with the employees working. Pick a
          day to review.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Select day">
        {dates.map((date, i) => (
          <Button
            key={i}
            size="sm"
            variant={i === selected ? "default" : "outline"}
            aria-pressed={i === selected}
            onClick={() => setSelected(i)}
          >
            {date.toLocaleDateString("en-US", { weekday: "short" })}{" "}
            {date.getDate()}
            {coverage.days[i].totals.shortfall > 0 && (
              <Badge
                className="bg-amber-500 text-white"
                title={`${coverage.days[i].totals.shortfall} understaffed hours`}
                aria-label={`${coverage.days[i].totals.shortfall} understaffed hours`}
              >
                {coverage.days[i].totals.shortfall}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <div className="max-h-[420px] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Hour</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Staff hours</TableHead>
              <TableHead className="text-right">
                Transactions / staff hour
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {day.rows.map((row) => (
              <TableRow
                key={row.hour}
                className={cn(
                  row.shortfall > 0 &&
                    "bg-amber-50 hover:bg-amber-100/70 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
                )}
              >
                <TableCell className="font-medium">
                  {hourLabel(row.hour)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.transactions}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right tabular-nums",
                    row.staffHours === 0 &&
                      row.transactions > 0 &&
                      "text-muted-foreground"
                  )}
                >
                  {row.staffHours}
                  {row.shortfall > 0 && (
                    <Badge
                      variant="outline"
                      className="ml-2 border-amber-500 text-amber-700 dark:text-amber-400"
                      title={`Needs ${row.required}, has ${row.staffHours}`}
                      aria-label={`Needs ${row.required}, has ${row.staffHours}`}
                    >
                      needs {row.required}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatRatio(row.ratio)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <dl className="flex flex-wrap gap-x-8 gap-y-2 rounded-lg border bg-muted/30 p-4">
        <div className="w-full text-sm font-medium">
          {DAYS_OF_WEEK[selected]} total
        </div>
        <Stat label="Transactions" value={String(day.totals.transactions)} />
        <Stat label="Staff hours" value={String(day.totals.staffHours)} />
        <Stat label="Overall ratio" value={formatRatio(day.totals.ratio)} />
        <Stat
          label="Understaffed hours"
          value={String(day.totals.shortfall)}
          warn={day.totals.shortfall > 0}
        />
      </dl>
    </section>
  )
}

function Stat({
  label,
  value,
  warn = false,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-xl font-semibold tabular-nums",
          warn && "text-amber-600 dark:text-amber-400"
        )}
      >
        {value}
      </dd>
    </div>
  )
}

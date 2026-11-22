import { useState } from "react"

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
              <TableRow key={row.hour}>
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
                  {row.staffHours === 0 && row.transactions > 0 && (
                    <span className="ml-2 text-xs">No staff</span>
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
      </dl>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

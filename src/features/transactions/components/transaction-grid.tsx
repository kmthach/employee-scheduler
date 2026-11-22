import { getWeekDays } from "@/domain/date"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  cellKey,
  formatDayHeader,
  formatHour,
  gridHours,
  parseCount,
} from "@/domain/transactions"
import type { GridValues } from "@/domain/transactions"
import { DAYS_OF_WEEK } from "@/domain/types"

interface Props {
  scheduleId: string
  values: GridValues
}

function total(texts: string[]): number {
  return texts.reduce((sum, t) => sum + (parseCount(t) ?? 0), 0)
}

/** Read-only hour × weekday grid of transaction counts, with totals. */
export function TransactionGrid({ scheduleId, values }: Props) {
  const dates = getWeekDays(scheduleId)
  const hours = gridHours(values)
  const days = DAYS_OF_WEEK.map((_, d) => d)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Hour</TableHead>
          {dates.map((date) => (
            <TableHead key={date.getTime()} className="text-center">
              <div>{DAYS_OF_WEEK[(date.getDay() + 6) % 7].slice(0, 3)}</div>
              <div className="text-xs font-normal text-muted-foreground">
                {formatDayHeader(date).split(", ")[1]}
              </div>
            </TableHead>
          ))}
          <TableHead className="text-right">Total</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hours.map((hour) => (
          <TableRow key={hour}>
            <TableCell className="font-medium">{formatHour(hour)}</TableCell>
            {days.map((day) => (
              <TableCell key={day} className="text-center tabular-nums">
                {values[cellKey(day, hour)] ?? ""}
              </TableCell>
            ))}
            <TableCell className="text-right text-muted-foreground tabular-nums">
              {total(days.map((d) => values[cellKey(d, hour)] ?? ""))}
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell className="font-medium">Total</TableCell>
          {days.map((day) => (
            <TableCell
              key={day}
              className="text-center font-medium tabular-nums"
            >
              {total(hours.map((h) => values[cellKey(day, h)] ?? ""))}
            </TableCell>
          ))}
          <TableCell className="text-right font-semibold tabular-nums">
            {total(Object.values(values))}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  )
}

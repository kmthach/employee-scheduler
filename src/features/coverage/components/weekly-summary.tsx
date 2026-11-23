import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatRatio } from "@/domain/coverage"
import type { WeekSummary } from "@/domain/coverage"
import { cn } from "@/lib/utils"

export function WeeklySummary({ week }: { week: WeekSummary }) {
  const cards = [
    {
      title: "Total transactions",
      value: String(week.totalTransactions),
      note: "All hours, Monday–Sunday",
    },
    {
      title: "Total staff hours",
      value: String(week.totalStaffHours),
      note: "Employees working, summed over every hour",
    },
    {
      title: "Overall transactions / staff hour",
      value: formatRatio(week.overallRatio),
      note: "Total transactions ÷ total staff hours (weekly productivity)",
    },
    {
      title: "Average hourly transactions / staff hour",
      value: formatRatio(week.averageHourlyRatio),
      note: "Mean of the hourly ratios, staffed hours only",
    },
    {
      title: "Understaffed staff-hours",
      value: String(week.understaffedHours),
      note: "Hours short of the required staffing",
      warn: week.understaffedHours > 0,
    },
  ]
  return (
    <section className="flex flex-col gap-3" aria-labelledby="summary-title">
      <h2 id="summary-title" className="text-lg font-semibold">
        Weekly summary
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.title} size="sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  c.warn && "text-amber-600 dark:text-amber-400"
                )}
              >
                {c.value}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}

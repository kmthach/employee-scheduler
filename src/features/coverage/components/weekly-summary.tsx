import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatRatio } from "@/domain/coverage"
import type { WeekSummary } from "@/domain/coverage"

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
  ]
  return (
    <section className="flex flex-col gap-3" aria-labelledby="summary-title">
      <h2 id="summary-title" className="text-lg font-semibold">
        Weekly summary
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} size="sm">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {c.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold tabular-nums">
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

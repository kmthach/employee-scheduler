import { Upload } from "lucide-react"

import { EmptyState } from "@/components/empty-state"
import { Button } from "@/components/ui/button"
import type { WeekCoverage } from "@/domain/coverage"

import { CoverageSection } from "./coverage-section"
import { WeeklySummary } from "./weekly-summary"

interface Props {
  scheduleId: string
  coverage: WeekCoverage
  hasTransactions: boolean
  onUploadTransactions: () => void
}

/** The Summary tab: daily coverage and weekly metrics, or a prompt when there is no demand data. */
export function SummaryView({
  scheduleId,
  coverage,
  hasTransactions,
  onUploadTransactions,
}: Props) {
  if (!hasTransactions) {
    return (
      <EmptyState
        icon={<Upload className="size-8" />}
        title="No transaction data"
        body="Upload the weekly transaction report to compare staffing against demand."
        action={
          <Button variant="outline" onClick={onUploadTransactions}>
            <Upload /> Upload transactions
          </Button>
        }
      />
    )
  }
  return (
    <>
      <CoverageSection
        key={scheduleId}
        scheduleId={scheduleId}
        coverage={coverage}
      />
      <WeeklySummary week={coverage.week} />
    </>
  )
}

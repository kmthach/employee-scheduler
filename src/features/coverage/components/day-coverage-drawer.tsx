import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"
import { formatRatio } from "@/domain/coverage"
import type { DayCoverage } from "@/domain/coverage"
import { cn } from "@/lib/utils"

import { DayCoverageTable } from "./coverage-section"

interface Props {
  onOpenChange: (open: boolean) => void
  date: Date
  day: DayCoverage
  onPrev?: () => void
  onNext?: () => void
}

/**
 * Non-modal right panel, a flex sibling of the workspace (which shrinks to make room) with one day's hourly coverage; opened from a roster day header.
 * No backdrop: the roster stays visible and editable, and the numbers update live.
 */
export function DayCoverageDrawer({
  onOpenChange,
  date,
  day,
  onPrev,
  onNext,
}: Props) {
  const stats = [
    {
      label: "Transactions",
      value: day.totals.transactions.toLocaleString("en-US"),
    },
    { label: "Staff hours", value: `${day.totals.staffHours}h` },
    { label: "Txn / staff hr", value: formatRatio(day.totals.ratio) },
    {
      label: "Understaffed",
      value: `${day.totals.shortfall}h`,
      warn: day.totals.shortfall > 0,
    },
  ]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector('[role="dialog"]'))
        onOpenChange(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onOpenChange])

  return (
    <aside
      aria-label="Daily coverage"
      className="flex h-full w-[380px] shrink-0 flex-col gap-4 border-l border-[#E5E7EB] bg-background text-sm shadow-[-4px_0_16px_rgba(0,0,0,0.06)] dark:border-border"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-4">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="Previous day"
            disabled={!onPrev}
            onClick={onPrev}
          >
            <ChevronLeft />
          </Button>
          <h2 className="text-xl font-medium">
            {date.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="Next day"
            disabled={!onNext}
            onClick={onNext}
          >
            <ChevronRight />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="rounded-full"
          aria-label="Close"
          onClick={() => onOpenChange(false)}
        >
          <X />
        </Button>
      </div>
      <dl className="mx-4 grid grid-cols-4 gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-3 dark:border-border dark:bg-muted/40">
        {stats.map((s) => (
          <div key={s.label}>
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
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          <DayCoverageTable day={day} />
        </div>
    </aside>
  )
}

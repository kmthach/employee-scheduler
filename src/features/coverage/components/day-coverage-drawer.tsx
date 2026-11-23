import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { formatRatio } from "@/domain/coverage"
import type { DayCoverage } from "@/domain/coverage"
import { cn } from "@/lib/utils"

import { DayCoverageTable } from "./coverage-section"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  date: Date
  day: DayCoverage
  onPrev?: () => void
  onNext?: () => void
}

/** Right slide-over with one day's hourly coverage; opened from a roster day header. */
export function DayCoverageDrawer({
  open,
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
    { label: "Staff hours", value: String(day.totals.staffHours) },
    { label: "Txn / staff hr", value: formatRatio(day.totals.ratio) },
    {
      label: "Understaffed",
      value: `${day.totals.shortfall}h`,
      warn: day.totals.shortfall > 0,
    },
  ]
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:sm:max-w-md">
        <SheetHeader className="pr-12">
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
            <SheetTitle>
              {date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </SheetTitle>
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
          <SheetDescription>
            Hourly transactions against the employees working.
          </SheetDescription>
        </SheetHeader>
        <dl className="grid grid-cols-4 gap-2 px-4">
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
      </SheetContent>
    </Sheet>
  )
}

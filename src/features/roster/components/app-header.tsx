import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatWeekRange } from "@/domain/date"
import { useScheduleStore } from "@/store/schedule-store"

export function AppHeader() {
  const currentScheduleId = useScheduleStore((s) => s.currentScheduleId)
  const todayScheduleId = useScheduleStore((s) => s.todayScheduleId)
  const goPrev = useScheduleStore((s) => s.goToPreviousWeek)
  const goNext = useScheduleStore((s) => s.goToNextWeek)
  const goToday = useScheduleStore((s) => s.goToCurrentWeek)

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <h1 className="text-lg font-semibold">Staff Scheduler</h1>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="Previous week" onClick={goPrev}>
          <ChevronLeft />
        </Button>
        <span className="min-w-48 text-center text-sm font-medium">
          {formatWeekRange(currentScheduleId)}
        </span>
        <Button variant="outline" size="icon" aria-label="Next week" onClick={goNext}>
          <ChevronRight />
        </Button>
        <Button
          variant="secondary"
          onClick={goToday}
          disabled={currentScheduleId === todayScheduleId}
        >
          Current week
        </Button>
      </div>
    </header>
  )
}

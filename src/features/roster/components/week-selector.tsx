import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatWeekRange } from "@/domain/date"
import { useScheduleStore } from "@/store/schedule-store"

export function WeekSelector() {
  const currentScheduleId = useScheduleStore((s) => s.currentScheduleId)
  const todayScheduleId = useScheduleStore((s) => s.todayScheduleId)
  const goPrev = useScheduleStore((s) => s.goToPreviousWeek)
  const goNext = useScheduleStore((s) => s.goToNextWeek)
  const goToday = useScheduleStore((s) => s.goToCurrentWeek)

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="icon" className="rounded-full" aria-label="Previous week" onClick={goPrev}>
        <ChevronLeft />
      </Button>
      <Button
        variant="outline"
        className="rounded-full"
        onClick={goToday}
        disabled={currentScheduleId === todayScheduleId}
      >
        Current week
      </Button>
      <Button variant="ghost" size="icon" className="rounded-full" aria-label="Next week" onClick={goNext}>
        <ChevronRight />
      </Button>
      <span className="ml-1 min-w-56 text-xl">
        {formatWeekRange(currentScheduleId)}
      </span>
    </div>
  )
}

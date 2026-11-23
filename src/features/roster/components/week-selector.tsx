import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatWeekRange } from "@/domain/date"
import { useScheduleStore } from "@/store/schedule-store"

/** Calendar-style navigation: [This week] ‹ › week range. */
export function WeekSelector() {
  const currentScheduleId = useScheduleStore((s) => s.currentScheduleId)
  const todayScheduleId = useScheduleStore((s) => s.todayScheduleId)
  const goPrev = useScheduleStore((s) => s.goToPreviousWeek)
  const goNext = useScheduleStore((s) => s.goToNextWeek)
  const goToday = useScheduleStore((s) => s.goToCurrentWeek)

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        className="rounded-full px-4"
        onClick={goToday}
        disabled={currentScheduleId === todayScheduleId}
      >
        This week
      </Button>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Previous week"
          onClick={goPrev}
        >
          <ChevronLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Next week"
          onClick={goNext}
        >
          <ChevronRight />
        </Button>
      </div>
      <h2 className="px-3 text-2xl font-normal">
        {formatWeekRange(currentScheduleId)}
      </h2>
    </div>
  )
}

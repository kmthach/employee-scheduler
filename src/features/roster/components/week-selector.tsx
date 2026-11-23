import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatWeekRange, getWeekOptions } from "@/domain/date"
import { cn } from "@/lib/utils"
import { useScheduleStore } from "@/store/schedule-store"

/** Calendar-style navigation: [This week] ‹ › week range (dropdown). */
export function WeekSelector() {
  const currentScheduleId = useScheduleStore((s) => s.currentScheduleId)
  const todayScheduleId = useScheduleStore((s) => s.todayScheduleId)
  const goPrev = useScheduleStore((s) => s.goToPreviousWeek)
  const goNext = useScheduleStore((s) => s.goToNextWeek)
  const goToday = useScheduleStore((s) => s.goToCurrentWeek)
  const goToWeek = useScheduleStore((s) => s.goToWeek)
  const schedules = useScheduleStore((s) => s.schedules)
  const options = getWeekOptions(
    currentScheduleId,
    schedules.map((x) => x.id)
  )

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
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              aria-label="Select week"
              className="h-10 gap-2 rounded-full px-3 text-2xl font-normal"
            />
          }
        >
          {formatWeekRange(currentScheduleId)}
          <ChevronDown className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 min-w-64">
          {options.map((id) => {
            const schedule = schedules.find((x) => x.id === id)
            return (
              <DropdownMenuItem
                key={id}
                onClick={() => goToWeek(id)}
                className={cn(
                  id === currentScheduleId && "bg-muted font-medium"
                )}
                ref={(el) => {
                  if (id === currentScheduleId)
                    el?.scrollIntoView({ block: "center" })
                }}
              >
                <span className="flex-1">{formatWeekRange(id)}</span>
                {id === todayScheduleId && (
                  <span className="text-xs text-primary">This week</span>
                )}
                {schedule && (
                  <span className="text-xs text-muted-foreground capitalize">
                    {schedule.status}
                  </span>
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

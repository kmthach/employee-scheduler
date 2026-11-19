import { useMemo } from "react"

import { filterBySchedule } from "@/domain/schedule-data"
import { useScheduleStore } from "@/store/schedule-store"

import { RosterGrid } from "./roster-grid"

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed p-12 text-center">
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

export function RosterWorkspace() {
  const scheduleId = useScheduleStore((s) => s.currentScheduleId)
  const hasSchedule = useScheduleStore((s) => s.existingScheduleIds.includes(s.currentScheduleId))
  const allStaff = useScheduleStore((s) => s.staff)
  const allShifts = useScheduleStore((s) => s.shifts)
  const allAssignments = useScheduleStore((s) => s.assignments)

  const staff = useMemo(() => filterBySchedule(allStaff, scheduleId), [allStaff, scheduleId])
  const shifts = useMemo(() => filterBySchedule(allShifts, scheduleId), [allShifts, scheduleId])
  const assignments = useMemo(
    () => filterBySchedule(allAssignments, scheduleId),
    [allAssignments, scheduleId]
  )

  return (
    <main className="p-6">
      {!hasSchedule ? (
        <EmptyState
          title="No schedule for this week"
          body="Nothing has been planned for this week yet."
        />
      ) : staff.length === 0 ? (
        <EmptyState title="No employees yet" body="Add employees to start building the roster." />
      ) : (
        <>
          <RosterGrid scheduleId={scheduleId} staff={staff} shifts={shifts} assignments={assignments} />
          {assignments.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">No shifts assigned yet.</p>
          )}
        </>
      )}
    </main>
  )
}

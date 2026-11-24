import { CalendarPlus, Clock, Copy, Plus, Upload } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { computeCoverage } from "@/domain/coverage"
import { formatWeekRange, getWeekDays } from "@/domain/date"
import {
  findSourceScheduleId,
  getDefaultSetup,
  getSetupFromSource,
} from "@/domain/schedule"
import { filterBySchedule } from "@/domain/schedule-data"
import type { Staff } from "@/domain/types"
import { DayCoverageDrawer } from "@/features/coverage/components/day-coverage-drawer"
import { WeeklySummary } from "@/features/coverage/components/weekly-summary"
import { DeleteStaffDialog } from "@/features/staff/components/delete-staff-dialog"
import { ShiftTemplatesDialog } from "@/features/shifts/components/shift-templates-dialog"
import { TransactionsDialog } from "@/features/transactions/components/transactions-dialog"
import { StaffFormDialog } from "@/features/staff/components/staff-form-dialog"
import {
  getTransactionsPerStaffHour,
  useScheduleStore,
} from "@/store/schedule-store"

import { useAutoSchedule } from "../use-auto-schedule"
import { AutoScheduleButton, AutoScheduleError } from "./auto-schedule-panel"
import { RosterLegend } from "./roster-legend"
import { DeleteScheduleButton } from "./delete-schedule-button"
import { PublishBar } from "./publish-bar"
import { NewScheduleDialog } from "./new-schedule-dialog"
import { RosterGrid } from "./roster-grid"
import { WeekSelector } from "./week-selector"

export function RosterWorkspace() {
  const scheduleId = useScheduleStore((s) => s.currentScheduleId)
  const schedule = useScheduleStore((s) =>
    s.schedules.find((x) => x.id === s.currentScheduleId)
  )
  const published = useScheduleStore(
    (s) => s.publishedSnapshots[s.currentScheduleId]
  )
  const allStaff = useScheduleStore((s) => s.staff)
  const allShifts = useScheduleStore((s) => s.shifts)
  const allAssignments = useScheduleStore((s) => s.assignments)
  const allTransactions = useScheduleStore((s) => s.transactions)
  const report = useScheduleStore(
    (s) => s.transactionReports[s.currentScheduleId]
  )
  const perStaffHour = useScheduleStore((s) =>
    getTransactionsPerStaffHour(s, s.currentScheduleId)
  )
  const schedules = useScheduleStore((s) => s.schedules)
  const reports = useScheduleStore((s) => s.transactionReports)
  const createSchedule = useScheduleStore((s) => s.createSchedule)
  const copyPreviousSchedule = useScheduleStore((s) => s.copyPreviousSchedule)
  const addStaffMany = useScheduleStore((s) => s.addStaffMany)
  const updateStaff = useScheduleStore((s) => s.updateStaff)
  const deleteStaff = useScheduleStore((s) => s.deleteStaff)

  const auto = useAutoSchedule()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [deleting, setDeleting] = useState<Staff | null>(null)
  const [shiftsOpen, setShiftsOpen] = useState(false)
  const [transactionsOpen, setTransactionsOpen] = useState(false)
  const [newScheduleOpen, setNewScheduleOpen] = useState(false)
  const [openDay, setOpenDay] = useState<number | null>(null)

  const staff = useMemo(
    () => filterBySchedule(allStaff, scheduleId),
    [allStaff, scheduleId]
  )
  const shifts = useMemo(
    () => filterBySchedule(allShifts, scheduleId),
    [allShifts, scheduleId]
  )
  const assignments = useMemo(
    () => filterBySchedule(allAssignments, scheduleId),
    [allAssignments, scheduleId]
  )

  const transactions = useMemo(
    () => filterBySchedule(allTransactions, scheduleId),
    [allTransactions, scheduleId]
  )

  const coverage = useMemo(
    () => computeCoverage(shifts, assignments, transactions, perStaffHour),
    [shifts, assignments, transactions, perStaffHour]
  )

  // For a week with no schedule: the latest earlier schedule seeds the New schedule dialog and Copy.
  const sourceId = findSourceScheduleId(
    schedules.map((x) => x.id),
    scheduleId
  )
  const newScheduleSetup = useMemo(() => {
    if (!sourceId) return getDefaultSetup()
    const report = reports[sourceId]
    return getSetupFromSource({
      staff: filterBySchedule(allStaff, sourceId),
      shifts: filterBySchedule(allShifts, sourceId),
      assignments: [],
      transactions: filterBySchedule(allTransactions, sourceId),
      transactionSource: report
        ? { fileName: report.fileName, reportRange: report.reportRange }
        : undefined,
    })
  }, [sourceId, reports, allStaff, allShifts, allTransactions])

  if (!schedule) {
    return (
      <main className="flex min-h-svh flex-col gap-4 bg-calendar p-6">
        <WeekSelector />
        <EmptyState
          icon={<CalendarPlus className="size-8" />}
          title="No schedule for this week"
          body={
            sourceId
              ? `Nothing has been planned for ${formatWeekRange(scheduleId)} yet. Start fresh, or copy ${formatWeekRange(sourceId)}.`
              : `Nothing has been planned for ${formatWeekRange(scheduleId)} yet.`
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => setNewScheduleOpen(true)}
              >
                <Plus /> New schedule
              </Button>
              {sourceId && (
                <Button
                  variant="outline"
                  title={`Copies ${formatWeekRange(sourceId)}`}
                  onClick={copyPreviousSchedule}
                >
                  <Copy /> Copy previous schedule
                </Button>
              )}
            </div>
          }
        />
        <NewScheduleDialog
          open={newScheduleOpen}
          onOpenChange={setNewScheduleOpen}
          scheduleId={scheduleId}
          initial={newScheduleSetup}
          onCreate={createSchedule}
        />
      </main>
    )
  }

  const drawerDay = openDay !== null && transactions.length > 0 ? openDay : null

  return (
    <div className="flex h-svh bg-calendar">
      <main className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <PublishBar
          schedule={schedule}
          staff={staff}
          shifts={shifts}
          assignments={assignments}
          leading={<WeekSelector />}
          actions={
            <>
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => setTransactionsOpen(true)}
              >
                <Upload /> Upload transactions
              </Button>
              <Button
                variant="ghost"
                className="h-9"
                onClick={() => setShiftsOpen(true)}
              >
                <Clock /> Shifts
              </Button>
              <div className="mx-1 h-5 w-px bg-border" aria-hidden />
              <DeleteScheduleButton
                scheduleId={scheduleId}
                isPublished={
                  published !== undefined || schedule.status === "published"
                }
                disabled={auto.status === "running"}
              />
              <AutoScheduleButton
                auto={auto}
                staffCount={staff.length}
                shiftCount={shifts.length}
                hasTransactions={transactions.length > 0}
              />
            </>
          }
        />
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <WeeklySummary
              week={transactions.length > 0 ? coverage.week : null}
            />
            <div className="ml-auto">
              <RosterLegend />
            </div>
          </div>
          <AutoScheduleError auto={auto} />
          <RosterGrid
            scheduleId={scheduleId}
            staff={staff}
            shifts={shifts}
            assignments={assignments}
            published={published}
            coverage={transactions.length > 0 ? coverage : undefined}
            selectedDay={drawerDay}
            onSelectDay={setOpenDay}
            onOpenShifts={() => setShiftsOpen(true)}
            onAddStaff={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            onDeleteStaff={setDeleting}
            onEditStaff={(s) => {
              setEditing(s)
              setFormOpen(true)
            }}
          />
        </div>

        <TransactionsDialog
          open={transactionsOpen}
          onOpenChange={setTransactionsOpen}
          scheduleId={scheduleId}
          saved={transactions}
          report={report}
        />
        <ShiftTemplatesDialog
          open={shiftsOpen}
          onOpenChange={setShiftsOpen}
          shifts={shifts}
          assignments={assignments}
        />
        <StaffFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          staff={editing}
          onSubmit={(inputs) =>
            editing ? updateStaff(editing.id, inputs[0]) : addStaffMany(inputs)
          }
        />
        <DeleteStaffDialog
          staff={deleting}
          assignmentCount={
            deleting
              ? assignments.filter((a) => a.staffId === deleting.id).length
              : 0
          }
          onOpenChange={(open) => !open && setDeleting(null)}
          onConfirm={(id) => {
            deleteStaff(id)
            setDeleting(null)
          }}
        />
      </main>
      {drawerDay !== null && (
        <DayCoverageDrawer
          onOpenChange={(open) => !open && setOpenDay(null)}
          date={getWeekDays(scheduleId)[drawerDay]}
          day={coverage.days[drawerDay]}
          onPrev={drawerDay > 0 ? () => setOpenDay(drawerDay - 1) : undefined}
          onNext={drawerDay < 6 ? () => setOpenDay(drawerDay + 1) : undefined}
        />
      )}
    </div>
  )
}

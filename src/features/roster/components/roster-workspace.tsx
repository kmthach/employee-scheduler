import { CalendarPlus, Clock, Plus, Upload } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/empty-state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { computeCoverage } from "@/domain/coverage"
import { formatWeekRange } from "@/domain/date"
import { filterBySchedule } from "@/domain/schedule-data"
import type { Staff } from "@/domain/types"
import { SummaryView } from "@/features/coverage/components/summary-view"
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
import { OverMaxAlert } from "./over-max-alert"
import { PublishBar } from "./publish-bar"
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
  const createSchedule = useScheduleStore((s) => s.createSchedule)
  const addStaffMany = useScheduleStore((s) => s.addStaffMany)
  const updateStaff = useScheduleStore((s) => s.updateStaff)
  const deleteStaff = useScheduleStore((s) => s.deleteStaff)

  const auto = useAutoSchedule()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [deleting, setDeleting] = useState<Staff | null>(null)
  const [tab, setTab] = useState<"roster" | "summary">("roster")
  const [shiftsOpen, setShiftsOpen] = useState(false)
  const [transactionsOpen, setTransactionsOpen] = useState(false)

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

  if (!schedule) {
    return (
      <main className="flex min-h-svh flex-col gap-4 bg-calendar p-6">
        <WeekSelector />
        <EmptyState
          icon={<CalendarPlus className="size-8" />}
          title="No schedule for this week"
          body={`Nothing has been planned for ${formatWeekRange(scheduleId)} yet.`}
          action={
            <Button onClick={createSchedule}>
              <Plus /> New schedule
            </Button>
          }
        />
      </main>
    )
  }

  return (
    <main className="flex h-svh flex-col gap-4 bg-calendar p-6">
      <div className="flex items-start justify-between gap-4">
        <PublishBar
          schedule={schedule}
          staff={staff}
          shifts={shifts}
          assignments={assignments}
        >
          <WeekSelector />
        </PublishBar>
        <div className="flex items-center gap-2">
          <AutoScheduleButton
            auto={auto}
            scheduleId={scheduleId}
            staffCount={staff.length}
            shiftCount={shifts.length}
            hasTransactions={transactions.length > 0}
            assignmentCount={assignments.length}
            isPublished={
              published !== undefined || schedule.status === "published"
            }
          />
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setTransactionsOpen(true)}
          >
            <Upload /> Upload transactions
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => setShiftsOpen(true)}
          >
            <Clock /> Shifts ({shifts.length})
          </Button>
        </div>
      </div>
      <Tabs
        className="min-h-0 flex-1"
        value={tab}
        onValueChange={(value) => setTab(value as "roster" | "summary")}
      >
        <TabsList variant="line">
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="summary">Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="roster" className="flex min-h-0 flex-col gap-4">
          <AutoScheduleError auto={auto} />
          <OverMaxAlert
            staff={staff}
            shifts={shifts}
            assignments={assignments}
          />
          <RosterGrid
            scheduleId={scheduleId}
            staff={staff}
            shifts={shifts}
            assignments={assignments}
            published={published}
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
        </TabsContent>

        <TabsContent value="summary" className="flex min-h-0 flex-col gap-6 overflow-y-auto">
          <SummaryView
            scheduleId={scheduleId}
            coverage={coverage}
            hasTransactions={transactions.length > 0}
            onUploadTransactions={() => setTransactionsOpen(true)}
          />
        </TabsContent>
      </Tabs>

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
  )
}

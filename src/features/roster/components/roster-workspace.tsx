import { CalendarPlus, Clock, Plus, Upload } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { formatWeekRange } from "@/domain/date"
import { filterBySchedule } from "@/domain/schedule-data"
import type { Staff } from "@/domain/types"
import { DeleteStaffDialog } from "@/features/staff/components/delete-staff-dialog"
import { ShiftTemplatesDialog } from "@/features/shifts/components/shift-templates-dialog"
import { TransactionsDialog } from "@/features/transactions/components/transactions-dialog"
import { StaffFormDialog } from "@/features/staff/components/staff-form-dialog"
import { useScheduleStore } from "@/store/schedule-store"

import { OverMaxAlert } from "./over-max-alert"
import { PublishBar } from "./publish-bar"
import { RosterGrid } from "./roster-grid"

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  )
}

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
  const createSchedule = useScheduleStore((s) => s.createSchedule)
  const addStaffMany = useScheduleStore((s) => s.addStaffMany)
  const updateStaff = useScheduleStore((s) => s.updateStaff)
  const deleteStaff = useScheduleStore((s) => s.deleteStaff)

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Staff | null>(null)
  const [deleting, setDeleting] = useState<Staff | null>(null)
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

  if (!schedule) {
    return (
      <main className="p-6">
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
    <main className="flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <PublishBar
          schedule={schedule}
          staff={staff}
          shifts={shifts}
          assignments={assignments}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTransactionsOpen(true)}>
            <Upload /> Upload transactions
          </Button>
          <Button variant="outline" onClick={() => setShiftsOpen(true)}>
            <Clock /> Shifts ({shifts.length})
          </Button>
        </div>
      </div>
      <OverMaxAlert staff={staff} shifts={shifts} assignments={assignments} />
      {staff.length > 0 && assignments.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No shifts assigned yet — use the + in a day cell to assign a shift.
        </p>
      )}
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
        onEditStaff={(s) => {
          setEditing(s)
          setFormOpen(true)
        }}
        onDeleteStaff={setDeleting}
      />

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

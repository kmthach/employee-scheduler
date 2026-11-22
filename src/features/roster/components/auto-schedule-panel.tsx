import { AlertTriangle, Loader2, Sparkles, Undo2, X } from "lucide-react"
import { useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { formatRange } from "@/domain/auto-schedule-report"
import { validateTransactionsPerStaffHour } from "@/domain/demand"
import { DAYS_OF_WEEK } from "@/domain/types"
import {
  getTransactionsPerStaffHour,
  useScheduleStore,
} from "@/store/schedule-store"

import { useAutoSchedule } from "../use-auto-schedule"

interface Props {
  scheduleId: string
  staffCount: number
  shiftCount: number
  hasTransactions: boolean
  assignmentCount: number
  isPublished: boolean
}

/** Why Auto-schedule cannot run yet, or null when it can. */
function blockedReason(p: Props): string | null {
  if (!p.hasTransactions) return "Upload transactions first"
  if (p.staffCount === 0) return "Add employees first"
  if (p.shiftCount === 0) return "Add shift templates first"
  return null
}

export function AutoScheduleButton(
  props: Props & { auto: ReturnType<typeof useAutoSchedule> }
) {
  const { auto, assignmentCount, isPublished } = props
  const [open, setOpen] = useState(false)
  const saved = useScheduleStore((s) =>
    getTransactionsPerStaffHour(s, props.scheduleId)
  )
  const [text, setText] = useState(String(saved))
  const reason = blockedReason(props)
  const running = auto.status === "running"

  const value = text.trim() === "" ? NaN : Number(text)
  const error = validateTransactionsPerStaffHour(value)

  if (running) {
    return (
      <div className="flex items-center gap-2">
        <Button disabled>
          <Loader2 className="animate-spin" /> Generating…
        </Button>
        <Button variant="outline" onClick={auto.cancel}>
          Cancel
        </Button>
      </div>
    )
  }

  function submit() {
    if (error) return
    setOpen(false)
    auto.run(value)
  }

  return (
    <>
      <Button
        disabled={reason !== null}
        title={reason ?? undefined}
        onClick={() => {
          setText(String(saved)) // the viewed week's saved value (15 by default)
          setOpen(true)
        }}
      >
        <Sparkles /> Auto-schedule
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <DialogHeader>
              <DialogTitle>Auto-schedule this week</DialogTitle>
              <DialogDescription>
                Generates an editable draft. Employees never exceed their
                maximum weekly hours.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="tx-per-staff-hour">
                Transactions per employee per hour
              </Label>
              <Input
                id="tx-per-staff-hour"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-invalid={!!error}
                autoFocus
              />
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Required staff per hour = transactions ÷ this value, rounded
                  up (at least 1). Lower values mean more staff are needed.
                </p>
              )}
            </div>
            {assignmentCount > 0 && (
              <p className="text-sm text-amber-700 dark:text-amber-400">
                This replaces all {assignmentCount} current assignment
                {assignmentCount === 1 ? "" : "s"}, including any you added by
                hand, with a new draft. You can undo it right afterwards.
                {isPublished &&
                  " The published version is kept until you publish."}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={error !== null}>
                Generate draft
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Result, undo, understaffing notes and error state for the last run. */
export function AutoScheduleReport({
  scheduleId,
  auto,
}: {
  scheduleId: string
  auto: ReturnType<typeof useAutoSchedule>
}) {
  const undoInfo = useScheduleStore((s) => s.autoScheduleUndo)
  const undo = useScheduleStore((s) => s.undoAutoSchedule)

  if (auto.status === "error") {
    return (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>Auto-schedule failed</AlertTitle>
        <AlertDescription>
          {auto.error} Your roster was not changed.
        </AlertDescription>
        <div data-slot="alert-action" className="absolute top-2 right-2">
          <Button size="sm" variant="outline" onClick={() => auto.run()}>
            Retry
          </Button>
        </div>
      </Alert>
    )
  }

  const summary = auto.summary
  if (!summary || summary.scheduleId !== scheduleId) return null
  const canUndo = undoInfo?.scheduleId === scheduleId

  return (
    <Alert>
      <Sparkles />
      <AlertTitle>
        Draft generated: {summary.assignmentCount} assignment
        {summary.assignmentCount === 1 ? "" : "s"}
      </AlertTitle>
      <AlertDescription>
        <p>
          Employees' maximum weekly hours were respected. Staffing assumes{" "}
          {summary.transactionsPerStaffHour} transactions per employee per hour.
          Review and edit the draft like any manual roster.
        </p>
        {summary.understaffed.length > 0 ? (
          <p className="text-amber-700 dark:text-amber-400">
            Understaffed ({summary.understaffedStaffHours} staff-hour
            {summary.understaffedStaffHours === 1 ? "" : "s"} short):{" "}
            {summary.understaffed
              .map(
                (r) =>
                  `${DAYS_OF_WEEK[r.dayOfWeek]} ${formatRange(r)} needs ${r.required}, has ${r.staffed}`
              )
              .join(" · ")}
            .
          </p>
        ) : (
          <p>No understaffed hours.</p>
        )}
        {summary.notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </AlertDescription>
      <div
        data-slot="alert-action"
        className="absolute top-2 right-2 flex gap-1"
      >
        {canUndo && (
          <Button size="sm" variant="outline" onClick={undo}>
            <Undo2 /> Undo
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Dismiss"
          onClick={auto.dismiss}
        >
          <X />
        </Button>
      </div>
    </Alert>
  )
}

import { AlertTriangle, Loader2, Sparkles } from "lucide-react"
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
import { validateTransactionsPerStaffHour } from "@/domain/demand"
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
        <Button variant="outline" disabled className="h-9 rounded-md">
          <Loader2 className="animate-spin" /> Generating…
        </Button>
        <Button
          variant="outline"
          className="h-9 rounded-md"
          onClick={auto.cancel}
        >
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
        variant="secondary"
        className="h-9 rounded-md"
        disabled={reason !== null}
        title={reason ?? undefined}
        onClick={() => {
          setText(String(saved)) // the viewed week's saved value (15 by default)
          setOpen(true)
        }}
      >
        <Sparkles className="fill-primary/20" /> Auto-schedule
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

/** Error state for the last run (success is visible in the roster itself). */
export function AutoScheduleError({
  auto,
}: {
  auto: ReturnType<typeof useAutoSchedule>
}) {
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

  return null
}

import { Check, Download, Plus, Trash2, Upload } from "lucide-react"
import { useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { formatWeekRange } from "@/domain/date"
import type { NewScheduleSetup, TransactionSource } from "@/domain/schedule"
import { validateShiftInput } from "@/domain/shift"
import type { ShiftValidation } from "@/domain/shift"
import { validateStaffBatch } from "@/domain/staff"
import type { StaffValidation } from "@/domain/staff"
import {
  buildTemplateCsv,
  recordsToGrid,
  sumCells,
} from "@/domain/transactions"
import type { TransactionCell } from "@/domain/transactions"
import { parseTransactionFile } from "@/features/transactions/parse-csv"
import { TransactionGrid } from "@/features/transactions/components/transaction-grid"
import { cn } from "@/lib/utils"

const STEPS = ["Shifts", "Employees", "Transactions"] as const

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  /** Pre-filled values: the defaults, or the latest earlier schedule's setup. */
  initial: NewScheduleSetup
  onCreate: (setup: NewScheduleSetup) => void
}

export function NewScheduleDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {/* Mounted only while open so the draft resets each time. */}
        {props.open && <Wizard {...props} />}
      </DialogContent>
    </Dialog>
  )
}

interface ShiftRow {
  key: number
  startTime: string
  endTime: string
}
interface StaffRow {
  key: number
  name: string
  hours: string
}

function Stepper({
  step,
  onStep,
}: {
  step: number
  onStep: (step: number) => void
}) {
  return (
    <ol className="flex items-center" aria-label="Progress">
      {STEPS.map((label, i) => {
        const done = i < step
        const current = i === step
        return (
          <li
            key={label}
            className={cn(
              "flex items-center",
              i < STEPS.length - 1 && "flex-1"
            )}
            aria-current={current ? "step" : undefined}
          >
            <button
              type="button"
              disabled={!done}
              onClick={() => onStep(i)}
              className="flex items-center gap-2 disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-sm font-medium",
                  (done || current) &&
                    "border-primary bg-primary text-primary-foreground",
                  !done && !current && "text-muted-foreground"
                )}
              >
                {done ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-sm",
                  current ? "font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "mx-3 h-px flex-1",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function downloadCsv(fileName: string, text: string) {
  const blob = new Blob([text], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function Wizard({ onOpenChange, scheduleId, initial, onCreate }: Props) {
  const nextKey = useRef(0)
  const key = () => nextKey.current++
  const fileInput = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(0)
  const [showErrors, setShowErrors] = useState(false)
  const [shifts, setShifts] = useState<ShiftRow[]>(() =>
    initial.shifts.map((s) => ({ key: key(), ...s }))
  )
  const [staff, setStaff] = useState<StaffRow[]>(() =>
    initial.staff.length > 0
      ? initial.staff.map((s) => ({
          key: key(),
          name: s.name,
          hours: String(s.maxWeeklyHours),
        }))
      : [{ key: key(), name: "", hours: "40" }]
  )
  const [cells, setCells] = useState<TransactionCell[]>(initial.transactions)
  const [source, setSource] = useState<TransactionSource | undefined>(
    initial.transactionSource
  )
  const [fileErrors, setFileErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [replacedCopy, setReplacedCopy] = useState(false)

  // Validation (derived; shown once the user tries to continue).
  const shiftErrors: ShiftValidation["errors"][] = shifts.map(
    (row) =>
      validateShiftInput(
        { startTime: row.startTime, endTime: row.endTime },
        shifts.map((r) => ({
          id: String(r.key),
          scheduleId,
          startTime: r.startTime,
          endTime: r.endTime,
        })),
        String(row.key)
      ).errors
  )
  const shiftsOk = shiftErrors.every((e) => Object.keys(e).length === 0)

  const filledStaff = staff.filter((r) => r.name.trim() !== "")
  const staffResult = validateStaffBatch(
    staff.map((r) => ({
      name: r.name,
      maxWeeklyHours: r.hours.trim() === "" ? NaN : Number(r.hours),
    }))
  )
  // At least one employee is required; blank rows are ignored.
  const staffOk = filledStaff.length > 0 && staffResult.ok
  const staffErrors: StaffValidation["errors"][] = staffResult.errors.map(
    (e) => e ?? {}
  )

  const stepOk = step === 0 ? shiftsOk : step === 1 ? staffOk : true

  function goTo(next: number) {
    setStep(next)
    setShowErrors(false)
  }

  function next() {
    if (!stepOk) {
      setShowErrors(true)
      return
    }
    goTo(step + 1)
  }

  function create() {
    if (!shiftsOk || !staffOk) return
    onCreate({
      shifts: shifts.map((r) => ({
        startTime: r.startTime,
        endTime: r.endTime,
      })),
      staff: staffResult.inputs,
      transactions: cells,
      transactionSource: cells.length > 0 ? source : undefined,
    })
    onOpenChange(false)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    const result = await parseTransactionFile(file)
    if (!result.ok) {
      setFileErrors(result.errors)
      return
    }
    setFileErrors([])
    setWarnings(result.warnings)
    setReplacedCopy(cells.length > 0)
    setCells(result.cells)
    setSource({ fileName: file.name, reportRange: result.reportRange })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>New schedule · {formatWeekRange(scheduleId)}</DialogTitle>
        <DialogDescription>
          Set up this week. Nothing is saved until you click Create schedule.
        </DialogDescription>
      </DialogHeader>

      <Stepper step={step} onStep={goTo} />

      <div className="grid max-h-[50vh] content-start gap-3 overflow-y-auto p-0.5">
        {step === 0 && (
          <>
            <p className="text-sm text-muted-foreground">
              The shifts for this week. Several employees can work the same
              shift, and different shifts can overlap.
            </p>
            {shifts.length === 0 && (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No shifts yet. Add one to start assigning employees.
              </p>
            )}
            {shifts.map((row, i) => {
              const errors = showErrors ? shiftErrors[i] : {}
              return (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_1fr_2rem] items-start gap-2"
                >
                  <div className="grid gap-1">
                    <Input
                      type="time"
                      value={row.startTime}
                      onChange={(e) =>
                        setShifts((rs) =>
                          rs.map((r) =>
                            r.key === row.key
                              ? { ...r, startTime: e.target.value }
                              : r
                          )
                        )
                      }
                      aria-label={`Shift ${i + 1} start`}
                      aria-invalid={!!errors.startTime}
                    />
                    {errors.startTime && (
                      <p className="text-xs text-destructive">
                        {errors.startTime}
                      </p>
                    )}
                  </div>
                  <div className="grid gap-1">
                    <Input
                      type="time"
                      value={row.endTime}
                      onChange={(e) =>
                        setShifts((rs) =>
                          rs.map((r) =>
                            r.key === row.key
                              ? { ...r, endTime: e.target.value }
                              : r
                          )
                        )
                      }
                      aria-label={`Shift ${i + 1} end`}
                      aria-invalid={!!errors.endTime}
                    />
                    {errors.endTime && (
                      <p className="text-xs text-destructive">
                        {errors.endTime}
                      </p>
                    )}
                    {errors.form && (
                      <p className="text-xs text-destructive">{errors.form}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove shift ${i + 1}`}
                    onClick={() =>
                      setShifts((rs) => rs.filter((r) => r.key !== row.key))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              )
            })}
            <Button
              variant="outline"
              className="justify-self-start rounded-full"
              onClick={() =>
                setShifts((rs) => [
                  ...rs,
                  { key: key(), startTime: "09:00", endTime: "17:00" },
                ])
              }
            >
              <Plus /> Add shift
            </Button>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-muted-foreground">
              Add at least one employee for the week.
            </p>

            {staff.length > 0 && (
              <div className="grid grid-cols-[1fr_7rem_2rem] gap-2 text-xs text-muted-foreground">
                <span>Name</span>
                <span>Max hours per week</span>
              </div>
            )}
            {staff.map((row, i) => {
              const errors = (showErrors && staffErrors[i]) || {}
              return (
                <div
                  key={row.key}
                  className="grid grid-cols-[1fr_7rem_2rem] items-start gap-2"
                >
                  <div className="grid gap-1">
                    <Input
                      value={row.name}
                      onChange={(e) =>
                        setStaff((rs) =>
                          rs.map((r) =>
                            r.key === row.key
                              ? { ...r, name: e.target.value }
                              : r
                          )
                        )
                      }
                      aria-label={`Employee ${i + 1} name`}
                      aria-invalid={!!errors.name}
                    />
                    {errors.name && (
                      <p className="text-xs text-destructive">{errors.name}</p>
                    )}
                  </div>
                  <div className="grid gap-1">
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      value={row.hours}
                      onChange={(e) =>
                        setStaff((rs) =>
                          rs.map((r) =>
                            r.key === row.key
                              ? { ...r, hours: e.target.value }
                              : r
                          )
                        )
                      }
                      aria-label={`Employee ${i + 1} maximum weekly hours`}
                      aria-invalid={!!errors.maxWeeklyHours}
                    />
                    {errors.maxWeeklyHours && (
                      <p className="text-xs text-destructive">
                        {errors.maxWeeklyHours}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove employee ${i + 1}`}
                    disabled={staff.length === 1}
                    title={
                      staff.length === 1
                        ? "A schedule needs at least one employee"
                        : undefined
                    }
                    onClick={() =>
                      setStaff((rs) => rs.filter((r) => r.key !== row.key))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              )
            })}
            <Button
              variant="outline"
              className="justify-self-start rounded-full"
              onClick={() =>
                setStaff((rs) => [...rs, { key: key(), name: "", hours: "40" }])
              }
            >
              <Plus /> Add employee
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-muted-foreground">
              Optional. Upload your hourly transactions report to guide
              Auto-schedule, or add it later.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => fileInput.current?.click()}
              >
                <Upload /> Upload CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() =>
                  downloadCsv(
                    `transaction_template_${scheduleId}.csv`,
                    buildTemplateCsv(scheduleId)
                  )
                }
              >
                <Download /> Download CSV template
              </Button>
              {cells.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  onClick={() => {
                    setCells([])
                    setSource(undefined)
                    setWarnings([])
                    setReplacedCopy(false)
                  }}
                >
                  <Trash2 /> Remove
                </Button>
              )}
              <input
                ref={fileInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0])
                  e.target.value = "" // allow re-selecting the same file
                }}
              />
            </div>
            {fileErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertTitle>We couldn't read that file</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc pl-4">
                    {fileErrors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {warnings.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {warnings.join(" ")}
              </p>
            )}
            {cells.length > 0 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {sumCells(cells)} transactions
                  {source?.fileName
                    ? ` · ${source.fileName}`
                    : " · copied from the latest earlier schedule"}
                  {replacedCopy && " · replaced the copied data"}
                </p>
                <TransactionGrid
                  scheduleId={scheduleId}
                  values={recordsToGrid(cells)}
                />
              </>
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                No transactions added.
              </p>
            )}
          </>
        )}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        {step > 0 && (
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => goTo(step - 1)}
          >
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Next</Button>
        ) : (
          <Button onClick={create}>Create schedule</Button>
        )}
      </DialogFooter>
    </>
  )
}

import { Download, Upload } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { validateTransactionsPerStaffHour } from "@/domain/demand"
import {
  buildTemplateCsv,
  buildTransactionCsv,
  buildTransactionRecords,
  exportFileName,
  formatReportRange,
  gridToCells,
  recordsToGrid,
  sumCells,
} from "@/domain/transactions"
import type { GridValues } from "@/domain/transactions"
import type { TransactionRecord } from "@/domain/types"
import {
  getTransactionsPerStaffHour,
  useScheduleStore,
} from "@/store/schedule-store"
import type { TransactionReport } from "@/store/schedule-store"

import { parseTransactionFile } from "../parse-csv"
import { TransactionGrid } from "./transaction-grid"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  scheduleId: string
  saved: TransactionRecord[]
  report?: TransactionReport
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

export function TransactionsDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        {/* Mounted only while open so the working draft resets each time. */}
        {props.open && <TransactionsEditor {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function TransactionsEditor({
  onOpenChange,
  scheduleId,
  saved,
  report,
}: Props) {
  const saveTransactions = useScheduleStore((s) => s.saveTransactions)
  const setPerStaffHour = useScheduleStore((s) => s.setTransactionsPerStaffHour)
  const savedPerStaffHour = useScheduleStore((s) =>
    getTransactionsPerStaffHour(s, scheduleId)
  )
  const fileInput = useRef<HTMLInputElement>(null)

  const [initial] = useState(() => recordsToGrid(saved))
  const [values, setValues] = useState<GridValues>(initial)
  const [source, setSource] = useState<{
    fileName: string | null
    reportRange?: string
    warnings: string[]
  }>({
    fileName: report?.fileName ?? null,
    reportRange: report?.reportRange,
    warnings: [],
  })
  const [perStaffHourText, setPerStaffHourText] = useState(
    String(savedPerStaffHour)
  )
  const [errors, setErrors] = useState<string[]>([])
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const cells = gridToCells(values)
  const perStaffHour =
    perStaffHourText.trim() === "" ? NaN : Number(perStaffHourText)
  const perStaffHourError = validateTransactionsPerStaffHour(perStaffHour)
  const dirty =
    JSON.stringify(values) !== JSON.stringify(initial) ||
    perStaffHour !== savedPerStaffHour
  const hadSaved = saved.length > 0
  const hasTable = cells.length > 0

  async function handleFile(file: File | undefined) {
    if (!file) return
    const result = await parseTransactionFile(file)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    setErrors([])
    setValues(recordsToGrid(result.cells))
    setSource({
      fileName: file.name,
      reportRange: result.reportRange,
      warnings: result.warnings,
    })
  }

  function save() {
    saveTransactions(
      buildTransactionRecords(scheduleId, cells, () => crypto.randomUUID()),
      { ...source, savedAt: new Date().toISOString() }
    )
    setPerStaffHour(scheduleId, perStaffHour)
    onOpenChange(false)
  }

  function cancel() {
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true)
      return
    }
    onOpenChange(false)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Transactions · {formatReportRange(scheduleId)}
        </DialogTitle>
        <DialogDescription>
          Upload a CSV report to review hourly counts. Nothing is saved until
          you click Save.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadCsv(
              `transaction_template_${scheduleId}.csv`,
              buildTemplateCsv(scheduleId)
            )
          }
        >
          <Download /> Download CSV template
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInput.current?.click()}
        >
          <Upload /> Upload CSV
        </Button>
        {hadSaved && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadCsv(
                exportFileName(scheduleId),
                buildTransactionCsv(scheduleId, initial)
              )
            }
          >
            <Download /> Export transactions
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

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTitle>The file could not be imported</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {source.warnings.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {source.warnings.join(" ")}
        </p>
      )}
      {hasTable ? (
        <>
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
              className="w-40"
              value={perStaffHourText}
              onChange={(e) => setPerStaffHourText(e.target.value)}
              aria-invalid={!!perStaffHourError}
            />
            {perStaffHourError ? (
              <p className="text-xs text-destructive">{perStaffHourError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Required staff per hour = transactions ÷ this value, rounded up
                (at least 1). Used by Coverage and Auto-schedule.
              </p>
            )}
          </div>
          <div className="max-h-[50vh] overflow-auto">
            <TransactionGrid scheduleId={scheduleId} values={values} />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
          <Upload className="size-8 text-muted-foreground" />
          <p className="font-medium">No transaction data</p>
          <p className="text-sm text-muted-foreground">
            Upload a transaction report to review and adjust hourly counts. Not
            sure of the format? Download the template first.
          </p>
        </div>
      )}

      <DialogFooter className="items-center">
        <span className="mr-auto text-sm text-muted-foreground">
          {hasTable
            ? `${sumCells(cells)} transactions${hadSaved && dirty ? " · will replace saved data" : ""}`
            : ""}
        </span>
        {confirmDiscard ? (
          <>
            <span className="text-sm">Discard changes?</span>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={() => onOpenChange(false)}>
              Discard
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={cancel}>
              Cancel
            </Button>
            {hasTable && (
              <Button
                onClick={save}
                disabled={!dirty || perStaffHourError !== null}
              >
                Save
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </>
  )
}

import { Plus, X } from "lucide-react"
import { useRef, useState } from "react"

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
import { validateStaffBatch, validateStaffInput } from "@/domain/staff"
import type { StaffInput, StaffValidation } from "@/domain/staff"
import type { Staff } from "@/domain/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Employee being edited; null to add one or more new employees. */
  staff: Staff | null
  /** Receives one input when editing, or one or more when adding. */
  onSubmit: (inputs: StaffInput[]) => void
}

export function StaffFormDialog({ open, onOpenChange, staff, onSubmit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={staff ? undefined : "sm:max-w-lg"}>
        {/* Remounts the form on each open so fields reset. */}
        {open &&
          (staff ? (
            <StaffForm
              key={staff.id}
              staff={staff}
              onCancel={() => onOpenChange(false)}
              onSubmit={(input) => {
                onSubmit([input])
                onOpenChange(false)
              }}
            />
          ) : (
            <AddStaffForm
              onCancel={() => onOpenChange(false)}
              onSubmit={(inputs) => {
                onSubmit(inputs)
                onOpenChange(false)
              }}
            />
          ))}
      </DialogContent>
    </Dialog>
  )
}

function StaffForm({
  staff,
  onCancel,
  onSubmit,
}: {
  staff: Staff
  onCancel: () => void
  onSubmit: (input: StaffInput) => void
}) {
  const [name, setName] = useState(staff.name)
  const [hours, setHours] = useState(String(staff.maxWeeklyHours))
  const [errors, setErrors] = useState<StaffValidation["errors"]>({})

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const input = { name, maxWeeklyHours: hours.trim() === "" ? NaN : Number(hours) }
    const result = validateStaffInput(input)
    if (!result.ok) {
      setErrors(result.errors)
      return
    }
    onSubmit(input)
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Edit employee</DialogTitle>
        <DialogDescription>
          Maximum weekly hours is a warning threshold, not a hard limit.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="staff-name">Name</Label>
        <Input
          id="staff-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!errors.name}
          autoFocus
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="staff-hours">Maximum weekly hours</Label>
        <Input
          id="staff-hours"
          type="number"
          inputMode="decimal"
          step="0.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          aria-invalid={!!errors.maxWeeklyHours}
        />
        {errors.maxWeeklyHours && (
          <p className="text-xs text-destructive">{errors.maxWeeklyHours}</p>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}

interface Row {
  key: number
  name: string
  hours: string
}

function AddStaffForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (inputs: StaffInput[]) => void
}) {
  const nextKey = useRef(1)
  const [rows, setRows] = useState<Row[]>([{ key: 0, name: "", hours: "40" }])
  const [errors, setErrors] = useState<StaffValidation["errors"][]>([])
  const [pendingFocus, setPendingFocus] = useState<number | null>(null)

  const filledCount = rows.filter((r) => r.name.trim() !== "").length

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addRow() {
    const key = nextKey.current++
    setRows((rs) => [...rs, { key, name: "", hours: "40" }])
    setPendingFocus(key)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = validateStaffBatch(
      rows.map((r) => ({
        name: r.name,
        maxWeeklyHours: r.hours.trim() === "" ? NaN : Number(r.hours),
      }))
    )
    if (!result.ok) {
      setErrors(result.errors.map((er) => er ?? {}))
      return
    }
    onSubmit(result.inputs)
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Add employees</DialogTitle>
        <DialogDescription>
          Add one or more employees. Maximum weekly hours is a warning, not a hard limit.
        </DialogDescription>
      </DialogHeader>
      <div className="grid max-h-[50vh] gap-3 overflow-y-auto p-0.5">
        <div className="grid grid-cols-[1fr_7rem_2rem] gap-2 text-xs text-muted-foreground">
          <span>Name</span>
          <span>Max hours / week</span>
        </div>
        {rows.map((row, i) => {
          const rowErrors = errors[i] ?? {}
          return (
            <div key={row.key} className="grid grid-cols-[1fr_7rem_2rem] items-start gap-2">
              <div className="grid gap-1">
                <Input
                  ref={(el) => {
                    if (el && pendingFocus === row.key) {
                      el.focus()
                      setPendingFocus(null)
                    }
                  }}
                  value={row.name}
                  onChange={(e) => updateRow(row.key, { name: e.target.value })}
                  aria-label={`Employee ${i + 1} name`}
                  aria-invalid={!!rowErrors.name}
                  autoFocus={i === 0}
                />
                {rowErrors.name && <p className="text-xs text-destructive">{rowErrors.name}</p>}
              </div>
              <div className="grid gap-1">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={row.hours}
                  onChange={(e) => updateRow(row.key, { hours: e.target.value })}
                  aria-label={`Employee ${i + 1} maximum weekly hours`}
                  aria-invalid={!!rowErrors.maxWeeklyHours}
                />
                {rowErrors.maxWeeklyHours && (
                  <p className="text-xs text-destructive">{rowErrors.maxWeeklyHours}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove row ${i + 1}`}
                disabled={rows.length === 1}
                onClick={() => {
                  setRows((rs) => rs.filter((r) => r.key !== row.key))
                  setErrors([])
                }}
              >
                <X />
              </Button>
            </div>
          )
        })}
      </div>
      <Button type="button" variant="ghost" className="justify-self-start" onClick={addRow}>
        <Plus /> Add another
      </Button>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {filledCount > 1 ? `Add ${filledCount} employees` : "Add employee"}
        </Button>
      </DialogFooter>
    </form>
  )
}

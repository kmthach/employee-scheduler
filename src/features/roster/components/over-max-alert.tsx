import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getOverMaxStaff } from "@/domain/assignment"
import type { Assignment, Shift, Staff } from "@/domain/types"

interface Props {
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
}

/** Warns about employees over their maximum weekly hours. Never blocks anything. */
export function OverMaxAlert({ staff, shifts, assignments }: Props) {
  const over = getOverMaxStaff(staff, assignments, shifts)
  if (over.length === 0) return null
  return (
    <Alert className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
      <AlertTriangle />
      <AlertTitle>
        {over.length === 1 ? "1 employee is" : `${over.length} employees are`} over their maximum
        weekly hours
      </AlertTitle>
      <AlertDescription>
        {over.map((o) => `${o.staff.name}: ${o.assigned}h of ${o.staff.maxWeeklyHours}h`).join(" · ")}
      </AlertDescription>
    </Alert>
  )
}

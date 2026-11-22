import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getOverMaxStaff } from "@/domain/assignment"
import type { Assignment, Shift, Staff } from "@/domain/types"

interface Props {
  staff: Staff[]
  shifts: Shift[]
  assignments: Assignment[]
}

/**
 * New assignments over the maximum are refused, but a longer shift template or a lower maximum
 * can still push an employee over. They are highlighted here and block publishing.
 */
export function OverMaxAlert({ staff, shifts, assignments }: Props) {
  const over = getOverMaxStaff(staff, assignments, shifts)
  if (over.length === 0) return null
  return (
    <Alert variant="destructive">
      <AlertTriangle />
      <AlertTitle>
        {over.length === 1 ? "1 employee is" : `${over.length} employees are`}{" "}
        over their maximum weekly hours
      </AlertTitle>
      <AlertDescription>
        {over
          .map(
            (o) =>
              `${o.staff.name}: ${o.assigned}h of ${o.staff.maxWeeklyHours}h`
          )
          .join(" · ")}
        . Reduce their shifts before publishing.
      </AlertDescription>
    </Alert>
  )
}

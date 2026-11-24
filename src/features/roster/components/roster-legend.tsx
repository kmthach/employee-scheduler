import { AlertTriangle } from "lucide-react"

/** Explains the roster's highlights: over-maximum and overlap (block publishing) and understaffing. */
export function RosterLegend() {
  return (
    <ul
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-1 text-xs text-muted-foreground"
      aria-label="Legend"
    >
      <li className="flex items-center gap-1.5">
        <AlertTriangle className="size-3 text-amber-600 dark:text-amber-400" />
        Over hour limit
      </li>
      <li className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm border border-destructive/30 bg-destructive/10" />
        Overlapping shifts
      </li>
      <li className="flex items-center gap-1.5">
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
          -2h
        </span>
        Understaffed
      </li>
    </ul>
  )
}

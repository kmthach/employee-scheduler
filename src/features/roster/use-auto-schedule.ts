import { useCallback, useRef, useState } from "react"

import { generateSchedule } from "@/domain/auto-schedule"
import { filterBySchedule } from "@/domain/schedule-data"
import {
  getTransactionsPerStaffHour,
  useScheduleStore,
} from "@/store/schedule-store"

export type AutoScheduleStatus = "idle" | "running" | "error"

interface AutoScheduleState {
  status: AutoScheduleStatus
  error?: string
}

/** Runs the generator in a worker and applies the result to the viewed week. */
export function useAutoSchedule() {
  const [state, setState] = useState<AutoScheduleState>({ status: "idle" })
  const controller = useRef<AbortController | null>(null)

  /** Generates for the viewed week using its saved transactions-per-employee-hour value. */
  const run = useCallback(async () => {
    const store = useScheduleStore.getState()
    const scheduleId = store.currentScheduleId
    const transactionsPerStaffHour = getTransactionsPerStaffHour(
      useScheduleStore.getState(),
      scheduleId
    )
    if (!window.crossOriginIsolated) {
      setState({
        status: "error",
        error:
          "Auto-schedule can't run on this website setup. Ask whoever hosts the app to enable it (see the README).",
      })
      return
    }
    const abort = new AbortController()
    controller.current = abort
    setState({ status: "running" })
    try {
      const result = await generateSchedule(
        {
          staff: filterBySchedule(store.staff, scheduleId),
          shifts: filterBySchedule(store.shifts, scheduleId),
          transactions: filterBySchedule(store.transactions, scheduleId),
        },
        { transactionsPerStaffHour, executor: "worker", signal: abort.signal }
      )
      // Dropped if the manager cancelled or moved to another week while solving.
      const current = useScheduleStore.getState()
      if (abort.signal.aborted || current.currentScheduleId !== scheduleId) {
        setState({ status: "idle" })
        return
      }
      current.applyGeneratedAssignments(result.assignments)
      setState({ status: "idle" })
    } catch (e) {
      if (abort.signal.aborted) {
        setState({ status: "idle" })
        return
      }
      setState({
        status: "error",
        error:
          e instanceof Error
            ? e.message
            : "Auto-schedule couldn't finish. Please try again.",
      })
    } finally {
      if (controller.current === abort) controller.current = null
    }
  }, [])

  const cancel = useCallback(() => controller.current?.abort(), [])

  return { ...state, run, cancel }
}

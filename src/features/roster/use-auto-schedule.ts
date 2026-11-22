import { useCallback, useRef, useState } from "react"

import { generateSchedule } from "@/domain/auto-schedule"
import { summarizeAutoSchedule } from "@/domain/auto-schedule-report"
import type { AutoScheduleSummary } from "@/domain/auto-schedule-report"
import { filterBySchedule } from "@/domain/schedule-data"
import { useScheduleStore } from "@/store/schedule-store"

export type AutoScheduleStatus = "idle" | "running" | "error"

interface AutoScheduleState {
  status: AutoScheduleStatus
  error?: string
  /** Result of the last run and the week it belongs to. */
  summary?: AutoScheduleSummary & { scheduleId: string }
}

/** Runs the generator in a worker and applies the result to the viewed week. */
export function useAutoSchedule() {
  const [state, setState] = useState<AutoScheduleState>({ status: "idle" })
  const controller = useRef<AbortController | null>(null)

  const run = useCallback(async () => {
    const store = useScheduleStore.getState()
    const scheduleId = store.currentScheduleId
    if (!window.crossOriginIsolated) {
      setState({
        status: "error",
        error:
          "Auto-scheduling needs a cross-origin isolated page (COOP/COEP headers), which this host does not send. See the README.",
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
        { executor: "worker", signal: abort.signal }
      )
      // Dropped if the manager cancelled or moved to another week while solving.
      const current = useScheduleStore.getState()
      if (abort.signal.aborted || current.currentScheduleId !== scheduleId) {
        setState({ status: "idle" })
        return
      }
      current.applyGeneratedAssignments(result.assignments)
      setState({
        status: "idle",
        summary: {
          ...summarizeAutoSchedule(
            result,
            filterBySchedule(current.staff, scheduleId)
          ),
          scheduleId,
        },
      })
    } catch (e) {
      if (abort.signal.aborted) {
        setState({ status: "idle" })
        return
      }
      setState({
        status: "error",
        error: e instanceof Error ? e.message : "Auto-scheduling failed.",
      })
    } finally {
      if (controller.current === abort) controller.current = null
    }
  }, [])

  const cancel = useCallback(() => controller.current?.abort(), [])
  const dismiss = useCallback(() => setState({ status: "idle" }), [])

  return { ...state, run, cancel, dismiss }
}

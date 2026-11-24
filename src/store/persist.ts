import { saveState } from "@/storage/persistence"
import type { PersistedData } from "@/storage/persistence"

import { useScheduleStore } from "./schedule-store"

type Store = typeof useScheduleStore
const SAVE_DELAY_MS = 300

function pick(s: ReturnType<Store["getState"]>): PersistedData {
  return {
    schedules: s.schedules,
    staff: s.staff,
    shifts: s.shifts,
    assignments: s.assignments,
    publishedSnapshots: s.publishedSnapshots,
    autoRemovedKeys: s.autoRemovedKeys,
    transactionsPerStaffHour: s.transactionsPerStaffHour,
    transactions: s.transactions,
    transactionReports: s.transactionReports,
  }
}

/**
 * Saves the persisted slice to IndexedDB (debounced) whenever it changes. Nothing is written
 * before hydration, so the empty initial state can never overwrite saved data. Returns `stop` and `flush`
 * (write any pending change now).
 */
export function startPersistence(store: Store = useScheduleStore): {
  stop: () => void
  flush: () => Promise<void>
} {
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: PersistedData | null = null
  let last = pick(store.getState())

  const flush = async () => {
    clearTimeout(timer)
    timer = undefined
    if (!pending) return
    const data = pending
    pending = null
    try {
      await saveState(data)
      if (store.getState().persistenceError === "save") {
        store.getState().setPersistenceError(null)
      }
    } catch {
      store.getState().setPersistenceError("save")
    }
  }

  const unsubscribe = store.subscribe((state) => {
    const next = pick(state)
    const changed = (Object.keys(next) as (keyof PersistedData)[]).some(
      (k) => next[k] !== last[k]
    )
    last = next
    if (!changed || !state.hydrated) return
    pending = next
    clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DELAY_MS)
  })

  const onHide = () => {
    if (document.visibilityState === "hidden") void flush()
  }
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", flush)
  }
  const stop = () => {
    unsubscribe()
    clearTimeout(timer)
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", flush)
    }
  }
  return { stop, flush }
}

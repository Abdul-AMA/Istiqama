"use client"

import { useEffect } from "react"
import { drainQueue } from "@/lib/sync"

export function SyncManager() {
  useEffect(() => {
    const handleOnline = () => drainQueue()

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        drainQueue()
      }
    }

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === "BACKGROUND_SYNC") {
        drainQueue()
      }
    }

    window.addEventListener("online", handleOnline)
    document.addEventListener("visibilitychange", handleVisibility)

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleSwMessage)
      navigator.serviceWorker.ready
        .then((sw) => {
          if ("sync" in sw) {
            // @ts-expect-error — Background Sync API not yet in TS lib
            sw.sync.register("istiqama-sync").catch(() => {})
          }
        })
        .catch(() => {})
    }

    // Drain on mount in case there are pending ops from a previous session
    if (navigator.onLine) drainQueue()

    return () => {
      window.removeEventListener("online", handleOnline)
      document.removeEventListener("visibilitychange", handleVisibility)
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage)
      }
    }
  }, [])

  return null
}

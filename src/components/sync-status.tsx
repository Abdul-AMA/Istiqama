"use client"

import { useState, useEffect, useCallback } from "react"
import { db } from "@/lib/db"
import { drainQueue, retryFailed } from "@/lib/sync"
import { Loader2, AlertTriangle } from "lucide-react"

export function SyncStatus({ role }: { role: string }) {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)

  const refresh = useCallback(async () => {
    const pending = await db.pendingOps.where("status").anyOf(["PENDING", "SYNCING"]).count()
    const failed = await db.pendingOps.where("status").equals("FAILED").count()
    setPendingCount(pending)
    setFailedCount(failed)
  }, [])

  useEffect(() => {
    if (typeof navigator !== "undefined") setIsOnline(navigator.onLine)
    refresh()

    const handleOnline = () => { setIsOnline(true); refresh() }
    const handleOffline = () => { setIsOnline(false); refresh() }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    const interval = setInterval(refresh, 5000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
    }
  }, [refresh])

  if (role !== "TEACHER") return null

  const handleRetry = async () => {
    setIsSyncing(true)
    await retryFailed()
    await refresh()
    setIsSyncing(false)
  }

  const handleManualSync = async () => {
    setIsSyncing(true)
    await drainQueue()
    await refresh()
    setIsSyncing(false)
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-700 bg-blue-50 rounded-lg mx-3 mb-2">
        <Loader2 className="h-3 w-3 animate-spin shrink-0" />
        <span>جاري المزامنة...</span>
      </div>
    )
  }

  if (failedCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-orange-700 bg-orange-50 rounded-lg mx-3 mb-2">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        <span className="flex-1">فشلت المزامنة</span>
        <button
          onClick={handleRetry}
          className="underline hover:no-underline font-medium"
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-red-700 bg-red-50 rounded-lg mx-3 mb-2">
        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
        <span>
          غير متصل
          {pendingCount > 0 && ` — ${pendingCount} في الانتظار`}
        </span>
      </div>
    )
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-yellow-700 bg-yellow-50 rounded-lg mx-3 mb-2">
        <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse shrink-0" />
        <span className="flex-1">{pendingCount} في الانتظار</span>
        <button
          onClick={handleManualSync}
          className="underline hover:no-underline font-medium"
        >
          مزامنة الآن
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-green-700">
      <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
      <span>متصل</span>
    </div>
  )
}

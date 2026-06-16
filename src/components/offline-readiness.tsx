"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/db"
import { WifiOff, Loader2, ShieldCheck } from "lucide-react"

type Status = "checking" | "ready" | "caching" | "not-ready"

export function OfflineReadiness() {
  const [status, setStatus] = useState<Status>("checking")

  useEffect(() => {
    async function check() {
      if (typeof navigator === "undefined") return

      // Must have an active service worker
      const swReg = await navigator.serviceWorker?.getRegistration().catch(() => null)
      const swActive = !!swReg?.active

      const [classes, surahs, warmedAt] = await Promise.all([
        db.cachedData.get("my-classes"),
        db.cachedData.get("all-surahs"),
        db.cachedData.get("_cache_warmed_at"),
      ])

      const hasClasses = Array.isArray(classes?.value) && (classes.value as unknown[]).length > 0
      const hasSurahs  = Array.isArray(surahs?.value)  && (surahs.value  as unknown[]).length > 0
      const hasRosters = !!warmedAt?.value

      if (!swActive) {
        setStatus("not-ready")
      } else if (hasClasses && hasSurahs && hasRosters) {
        setStatus("ready")
      } else {
        setStatus("caching")
      }
    }

    check()
    // Re-check every 8 seconds while warming
    const id = setInterval(check, 8000)
    return () => clearInterval(id)
  }, [])

  if (status === "checking") return null

  if (status === "ready") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-green-700">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
        <span>جاهز للعمل بدون إنترنت</span>
      </div>
    )
  }

  if (status === "caching") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-700">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>جارٍ تحضير البيانات...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-orange-600">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>غير جاهز للعمل بدون إنترنت</span>
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { db } from "@/lib/db"
import { WifiOff, Loader2, ShieldCheck } from "lucide-react"

type Status = "checking" | "ready" | "caching" | "not-ready"

async function getStatus(): Promise<Status> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return "not-ready"

  const swReg = await navigator.serviceWorker.getRegistration().catch(() => undefined)

  // SW is installing or waiting — it will become active soon
  const swPending = !!swReg?.installing || !!swReg?.waiting
  const swActive  = !!swReg?.active

  if (!swActive && !swPending) return "not-ready"
  if (!swActive && swPending)  return "caching" // SW on the way

  // SW is active — check if data is cached
  const [classes, surahs, warmedAt] = await Promise.all([
    db.cachedData.get("my-classes"),
    db.cachedData.get("all-surahs"),
    db.cachedData.get("_cache_warmed_at"),
  ])

  const hasData =
    Array.isArray(classes?.value) && (classes.value as unknown[]).length > 0 &&
    Array.isArray(surahs?.value)  && (surahs.value  as unknown[]).length > 0 &&
    !!warmedAt?.value

  return hasData ? "ready" : "caching"
}

export function OfflineReadiness() {
  const [status, setStatus] = useState<Status>("checking")

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      const s = await getStatus()
      if (!cancelled) setStatus(s)
    }

    refresh()

    // React immediately when a new SW takes control
    const onControllerChange = () => refresh()
    navigator.serviceWorker?.addEventListener("controllerchange", onControllerChange)

    // Poll until ready (stop only when fully ready)
    const id = setInterval(async () => {
      const s = await getStatus()
      if (!cancelled) {
        setStatus(s)
        if (s === "ready") clearInterval(id)
      }
    }, 3000)

    return () => {
      cancelled = true
      clearInterval(id)
      navigator.serviceWorker?.removeEventListener("controllerchange", onControllerChange)
    }
  }, [])

  if (status === "checking") return null

  if (status === "ready") return (
    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-green-700">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      <span>جاهز للعمل بدون إنترنت</span>
    </div>
  )

  if (status === "caching") return (
    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-700">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      <span>جارٍ تحضير البيانات...</span>
    </div>
  )

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 text-xs text-orange-600">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>غير جاهز للعمل بدون إنترنت</span>
    </div>
  )
}

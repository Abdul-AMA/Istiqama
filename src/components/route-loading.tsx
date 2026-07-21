"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"

const MIN_VISIBLE_MS = 500
const SAFETY_TIMEOUT_MS = 8000

const RouteLoadingContext = createContext<{ start: () => void; stop: () => void } | null>(null)

export function useRouteLoading() {
  const ctx = useContext(RouteLoadingContext)
  if (!ctx) throw new Error("useRouteLoading must be used within RouteLoadingProvider")
  return ctx
}

// Next commits a pathname change as soon as navigation lands — sometimes
// instantly, e.g. a prefetched route or one with its own loading.tsx that
// swaps in immediately. Without a minimum visible time the overlay could
// flip on and off within the same tick and never actually paint. `stop()`
// bypasses that minimum for cases with no navigation to wait for, like a
// failed login.
export function RouteLoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const isFirstRender = useRef(true)
  const startedAtRef = useRef<number | null>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearHideTimer() {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }

  function start() {
    clearHideTimer()
    startedAtRef.current = Date.now()
    setLoading(true)
  }

  function stop() {
    clearHideTimer()
    startedAtRef.current = null
    setLoading(false)
  }

  function finish() {
    if (startedAtRef.current === null) return
    clearHideTimer()
    const remaining = MIN_VISIBLE_MS - (Date.now() - startedAtRef.current)
    if (remaining <= 0) {
      startedAtRef.current = null
      setLoading(false)
    } else {
      hideTimerRef.current = setTimeout(() => {
        startedAtRef.current = null
        setLoading(false)
      }, remaining)
    }
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    finish()
  }, [pathname])

  useEffect(() => {
    if (!loading) return
    const timeout = setTimeout(stop, SAFETY_TIMEOUT_MS)
    return () => clearTimeout(timeout)
  }, [loading])

  return (
    <RouteLoadingContext.Provider value={{ start, stop }}>
      {children}
      {loading && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          role="status"
          aria-live="polite"
          aria-label="جارٍ التحميل"
        >
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={64}
            height={64}
            priority
            className="animate-[spin_1.1s_linear_infinite] drop-shadow-lg"
          />
        </div>
      )}
    </RouteLoadingContext.Provider>
  )
}

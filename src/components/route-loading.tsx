"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import Image from "next/image"

const RouteLoadingContext = createContext<{ start: () => void } | null>(null)

export function useRouteLoading() {
  const ctx = useContext(RouteLoadingContext)
  if (!ctx) throw new Error("useRouteLoading must be used within RouteLoadingProvider")
  return ctx
}

// Sidebar navigations feel instant once this fires — the pathname change
// (real or aborted) is what turns it back off; the timeout is only a
// safety net for a navigation that never resolves.
export function RouteLoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false)
  const pathname = usePathname()
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setLoading(false)
  }, [pathname])

  useEffect(() => {
    if (!loading) return
    const timeout = setTimeout(() => setLoading(false), 8000)
    return () => clearTimeout(timeout)
  }, [loading])

  return (
    <RouteLoadingContext.Provider value={{ start: () => setLoading(true) }}>
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

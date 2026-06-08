"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

const STORAGE_KEY = "pwa-install-dismissed"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function InstallPrompt({ role }: { role: string }) {
  const [show, setShow] = useState(false)
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (role !== "TEACHER") return
    if (localStorage.getItem(STORAGE_KEY)) return
    if (!/Android/i.test(navigator.userAgent)) return

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setShow(true)
    }

    window.addEventListener("beforeinstallprompt", handler)
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [role])

  if (!show) return null

  const handleInstall = async () => {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === "accepted") localStorage.setItem(STORAGE_KEY, "1")
    setShow(false)
  }

  const handleDismiss = () => {
    setShow(false)
    localStorage.setItem(STORAGE_KEY, "1")
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 z-50 bg-green-900 text-white rounded-xl p-4 shadow-xl flex items-start gap-3 md:left-auto md:w-80 md:right-64">
      <div className="flex-1">
        <p className="text-sm font-medium leading-snug">
          ثبّت التطبيق على شاشتك الرئيسية للعمل بدون إنترنت
        </p>
        <div className="flex gap-2 mt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleInstall}
            className="bg-white text-green-900 hover:bg-green-50 h-8 px-3 text-xs"
          >
            تثبيت
          </Button>
          <button
            onClick={handleDismiss}
            className="text-green-300 hover:text-white text-xs px-2 underline"
          >
            لاحقاً
          </button>
        </div>
      </div>
      <button onClick={handleDismiss} className="text-green-400 hover:text-white mt-0.5 shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

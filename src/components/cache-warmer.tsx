"use client"

import { useEffect } from "react"
import { db } from "@/lib/db"
import { getMyClasses, getClassRoster } from "@/lib/actions/daily-session.actions"

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export function CacheWarmer() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.onLine) return

    async function warm() {
      try {
        // Check if we warmed recently
        const meta = await db.cachedData.get("_cache_warmed_at")
        if (meta && Date.now() - (meta.updatedAt) < CACHE_TTL_MS) return

        const classes = await getMyClasses()
        await db.cachedData.put({ key: "classes", value: classes, updatedAt: Date.now() })

        // Cache roster for each class
        for (const cls of classes) {
          const roster = await getClassRoster(cls.id)
          await db.cachedData.put({
            key: `roster:${cls.id}`,
            value: roster,
            updatedAt: Date.now(),
          })
        }

        await db.cachedData.put({
          key: "_cache_warmed_at",
          value: true,
          updatedAt: Date.now(),
        })
      } catch {
        // Silent — offline or auth error, cache warming is best-effort
      }
    }

    warm()
  }, [])

  return null
}

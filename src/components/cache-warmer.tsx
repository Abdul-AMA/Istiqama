"use client"

import { useEffect } from "react"
import { db } from "@/lib/db"
import { getMyClasses, getClassRoster, getAllSurahs } from "@/lib/actions/daily-session.actions"

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

export function CacheWarmer() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.onLine) return

    async function warm() {
      try {
        const meta = await db.cachedData.get("_cache_warmed_at")
        if (meta && Date.now() - meta.updatedAt < CACHE_TTL_MS) return

        const [classes, surahs] = await Promise.all([getMyClasses(), getAllSurahs()])

        await db.cachedData.put({ key: "my-classes", value: classes, updatedAt: Date.now() })
        await db.cachedData.put({ key: "all-surahs", value: surahs, updatedAt: Date.now() })

        for (const cls of classes) {
          const roster = await getClassRoster(cls.id)
          await db.cachedData.put({ key: `roster:${cls.id}`, value: roster, updatedAt: Date.now() })
        }

        await db.cachedData.put({ key: "_cache_warmed_at", value: true, updatedAt: Date.now() })
      } catch {
        // Silent — offline or auth error
      }
    }

    warm()
  }, [])

  return null
}

"use client"

import { useRouter } from "next/navigation"

type Props = {
  classes: { id: string; name: string }[]
  selectedClassId: string
  from: string
  to: string
}

export function ClassPicker({ classes, selectedClassId, from, to }: Props) {
  const router = useRouter()

  function handleClassChange(classId: string) {
    if (!classId) {
      router.push("/report")
      return
    }
    const params = new URLSearchParams({ classId })
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    router.push(`/report?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={selectedClassId}
        onChange={(e) => handleClassChange(e.target.value)}
        className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-48"
      >
        <option value="">— اختر حلقة —</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  )
}

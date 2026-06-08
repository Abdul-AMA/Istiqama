"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function HistoryFilters({
  studentId,
  defaultFrom,
  defaultTo,
  defaultType,
}: {
  studentId: string
  defaultFrom: string
  defaultTo: string
  defaultType: string
}) {
  const router = useRouter()
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [type, setType] = useState(defaultType || "ALL")

  function apply() {
    const params = new URLSearchParams()
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    if (type && type !== "ALL") params.set("type", type)
    router.push(`/students/${studentId}/history?${params.toString()}`)
  }

  function reset() {
    setFrom("")
    setTo("")
    setType("ALL")
    router.push(`/students/${studentId}/history`)
  }

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 rounded-lg border bg-muted/30">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">من تاريخ</p>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">إلى تاريخ</p>
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-40"
        />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">نوع التسميع</p>
        <Select value={type} onValueChange={(v) => setType(v ?? "ALL")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="الكل" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">الكل</SelectItem>
            <SelectItem value="NEW">جديد</SelectItem>
            <SelectItem value="RECENT_REVISION">مراجعة قريبة</SelectItem>
            <SelectItem value="OLD_REVISION">مراجعة بعيدة</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button onClick={apply} className="bg-green-600 hover:bg-green-700 text-white">
        تطبيق
      </Button>
      <Button variant="outline" onClick={reset}>
        إعادة ضبط
      </Button>
    </div>
  )
}

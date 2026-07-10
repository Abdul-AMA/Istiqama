"use client"

import { useState } from "react"
import { Download, FileWarning } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { generateOfflineFormHtml } from "@/lib/telegram/generateOfflineForm"

type ClassOption = {
  id: string
  name: string
  roster: { id: string; fullName: string }[]
}

export function OfflineFormClient({
  teacherId,
  teacherName,
  botUsername,
  classes,
}: {
  teacherId: string
  teacherName: string
  botUsername: string
  classes: ClassOption[]
}) {
  const [classId, setClassId] = useState(classes[0]?.id ?? "")
  const selected = classes.find((c) => c.id === classId) ?? null

  const handleDownload = () => {
    if (!selected) return
    const html = generateOfflineFormHtml({
      teacherId,
      teacherName,
      halaqaId: selected.id,
      halaqaName: selected.name,
      roster: selected.roster,
      botUsername,
      generatedAt: new Date(),
    })
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `نموذج-${selected.name}-${new Date().toISOString().slice(0, 10)}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (classes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-2">
        <FileWarning className="h-10 w-10 mx-auto opacity-30" />
        <p>لا توجد حلقات مسندة إليك حالياً</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1.5">
        <Label>الحلقة</Label>
        <Select
          value={classId}
          onValueChange={(v) => setClassId(v ?? "")}
          items={classes.map((c) => ({ value: c.id, label: c.name }))}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="اختر حلقة" />
          </SelectTrigger>
          <SelectContent>
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected && (
        <p className="text-sm text-muted-foreground">{selected.roster.length} طالب في هذه الحلقة</p>
      )}

      <Button onClick={handleDownload} disabled={!selected} className="w-full h-12 gap-2">
        <Download className="h-4 w-4" />
        تنزيل النموذج
      </Button>

      <p className="text-xs text-muted-foreground">
        بعد التنزيل، افتح الملف من هاتفك حتى بدون اتصال بالإنترنت. عند إضافة أو حذف طالب من الحلقة، نزّل نسخة جديدة.
      </p>
    </div>
  )
}

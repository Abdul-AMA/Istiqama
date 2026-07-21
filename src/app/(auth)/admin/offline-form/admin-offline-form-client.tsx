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

type TeacherOption = {
  id: string
  fullName: string
  classes: ClassOption[]
}

type SurahOption = { number: number; nameAr: string; ayahCount: number; startPage: number }

export function AdminOfflineFormClient({
  botUsername,
  surahs,
  teachers,
}: {
  botUsername: string
  surahs: SurahOption[]
  teachers: TeacherOption[]
}) {
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "")
  const teacher = teachers.find((t) => t.id === teacherId) ?? null

  const [classId, setClassId] = useState(teacher?.classes[0]?.id ?? "")
  const selectedClass = teacher?.classes.find((c) => c.id === classId) ?? null

  const handleTeacherChange = (v: string | null) => {
    const id = v ?? ""
    setTeacherId(id)
    const t = teachers.find((x) => x.id === id)
    setClassId(t?.classes[0]?.id ?? "")
  }

  const handleDownload = () => {
    if (!teacher || !selectedClass) return
    const html = generateOfflineFormHtml({
      teacherId: teacher.id,
      teacherName: teacher.fullName,
      halaqaId: selectedClass.id,
      halaqaName: selectedClass.name,
      roster: selectedClass.roster,
      surahs,
      botUsername,
      generatedAt: new Date(),
    })
    const blob = new Blob([html], { type: "text/html;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `نموذج-${selectedClass.name}-${new Date().toISOString().slice(0, 10)}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (teachers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-2">
        <FileWarning className="h-10 w-10 mx-auto opacity-30" />
        <p>لا يوجد معلمون نشطون</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border bg-card p-4">
      <div className="space-y-1.5">
        <Label>المعلم</Label>
        <Select
          value={teacherId}
          onValueChange={handleTeacherChange}
          items={teachers.map((t) => ({ value: t.id, label: t.fullName }))}
        >
          <SelectTrigger className="h-11">
            <SelectValue placeholder="اختر معلماً" />
          </SelectTrigger>
          <SelectContent>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>الحلقة</Label>
        {teacher && teacher.classes.length > 0 ? (
          <Select
            value={classId}
            onValueChange={(v) => setClassId(v ?? "")}
            items={teacher.classes.map((c) => ({ value: c.id, label: c.name }))}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="اختر حلقة" />
            </SelectTrigger>
            <SelectContent>
              {teacher.classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground py-2">لا توجد حلقات نشطة لهذا المعلم</p>
        )}
      </div>

      {selectedClass && (
        <p className="text-sm text-muted-foreground">{selectedClass.roster.length} طالب في هذه الحلقة</p>
      )}

      <Button onClick={handleDownload} disabled={!selectedClass} className="w-full h-12 gap-2">
        <Download className="h-4 w-4" />
        تنزيل النموذج
      </Button>

      <p className="text-xs text-muted-foreground">
        يمكن مشاركة الملف مع المعلم مباشرة، أو استخدامه على جهاز مشترك — يقوم المعلم بمراجعة القائمة الظاهرة في الملف للتأكد من صحة الحلقة قبل التعبئة.
      </p>
    </div>
  )
}

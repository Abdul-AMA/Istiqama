"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Loader2, Users, Award } from "lucide-react"
import { toast } from "sonner"

type Halaqa = {
  id: string
  name: string
  teacherLabel: string
  totalStudents: number
  scoredCount: number
}

type CourseBadgeItem = { id: string; name: string }

type Course = {
  id: string
  name: string
  isActive: boolean
  badges: CourseBadgeItem[]
}

const COLUMN_OPTIONS: { key: string; label: string }[] = [
  { key: "studentName", label: "اسم الطالب" },
  { key: "teacherName", label: "المعلم" },
  { key: "courseName", label: "اسم الدورة" },
  { key: "score", label: "الدرجة" },
  { key: "nationalId", label: "رقم الهوية" },
  { key: "dateOfBirth", label: "تاريخ الميلاد" },
]

export function CourseDetailClient({ course, halaqas }: { course: Course; halaqas: Halaqa[] }) {
  const [exportScope, setExportScope] = useState<{ classId: string | null; label: string } | null>(null)
  const [columns, setColumns] = useState<string[]>(COLUMN_OPTIONS.map((c) => c.key))
  const [downloading, setDownloading] = useState(false)

  async function download() {
    if (columns.length === 0 || !exportScope) return
    setDownloading(true)
    try {
      const params = new URLSearchParams({ columns: columns.join(",") })
      if (exportScope.classId) params.set("classId", exportScope.classId)
      const res = await fetch(`/api/courses/${course.id}/xlsx?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        toast.error(data?.error ?? "تعذّر تصدير الملف")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${course.name}-${exportScope.label}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setExportScope(null)
    } catch {
      toast.error("تعذّر تصدير الملف")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      {course.badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {course.badges.map((b) => (
            <Badge key={b.id} variant="secondary" className="gap-1">
              <Award className="h-3 w-3" />
              {b.name}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="outline"
          className="gap-2"
          disabled={halaqas.length === 0}
          onClick={() => setExportScope({ classId: null, label: "كل-الحلقات" })}
        >
          <Download className="h-4 w-4" />
          تنزيل XLSX لكل الحلقات (ورقة لكل حلقة)
        </Button>
      </div>

      {halaqas.length === 0 && (
        <div className="py-14 text-center text-muted-foreground rounded-lg border space-y-2">
          <Users className="h-10 w-10 mx-auto opacity-30" />
          <p className="text-sm font-medium">لا توجد حلقات نشطة</p>
        </div>
      )}

      <div className="grid gap-3">
        {halaqas.map((h) => (
          <Card key={h.id}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{h.name}</CardTitle>
                <Badge variant={h.scoredCount >= h.totalStudents && h.totalStudents > 0 ? "default" : "secondary"}>
                  {h.scoredCount}/{h.totalStudents} طالب
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">👤 {h.teacherLabel}</p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                disabled={h.scoredCount === 0}
                onClick={() => setExportScope({ classId: h.id, label: h.name })}
              >
                <Download className="h-3.5 w-3.5" />
                تنزيل XLSX
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!exportScope} onOpenChange={(o) => !o && setExportScope(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>اختر الأعمدة المراد تصديرها</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {COLUMN_OPTIONS.map((opt) => (
              <div key={opt.key} className="flex items-center gap-2">
                <Checkbox
                  id={`col-${opt.key}`}
                  checked={columns.includes(opt.key)}
                  onCheckedChange={(checked) => {
                    setColumns((prev) =>
                      checked ? [...prev, opt.key] : prev.filter((c) => c !== opt.key)
                    )
                  }}
                />
                <Label htmlFor={`col-${opt.key}`} className="font-normal">{opt.label}</Label>
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setExportScope(null)}>إلغاء</Button>
            <Button onClick={download} disabled={downloading || columns.length === 0} className="gap-2">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              تنزيل
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

"use client"

import { useState, useTransition, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Download, Send, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { saveMessageLog, getAttendanceDays } from "@/lib/actions/messages.actions"

type Student = {
  id: string
  fullName: string
  guardianPhone: string | null
  guardianName: string | null
  classId: string | null
  className: string | null
  teacherName: string | null
  totalPages: number
  pageFrom: number | null
  pageTo: number | null
  fromSurahName: string | null
  fromAyah: number | null
  toSurahName: string | null
  toAyah: number | null
}

type ClassOption = {
  id: string
  name: string
  teacher: { fullName: string }
}

type Props = {
  students: Student[]
  classes: ClassOption[]
}

const now = new Date()
const DEFAULT_FROM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
const DEFAULT_TO = now.toISOString().slice(0, 10)

export function ReportCardsClient({ students, classes }: Props) {
  const [classId, setClassId] = useState("")
  const [studentId, setStudentId] = useState("")
  const [from, setFrom] = useState(DEFAULT_FROM)
  const [to, setTo] = useState(DEFAULT_TO)
  const [teacherNotes, setTeacherNotes] = useState("")
  const [attendanceDays, setAttendanceDays] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSending, startSend] = useTransition()

  const filteredStudents = classId
    ? students.filter((s) => s.classId === classId)
    : students

  const student = students.find((s) => s.id === studentId)

  // Fetch attendance days whenever student or date range changes
  useEffect(() => {
    if (!studentId || !from || !to) {
      setAttendanceDays(null)
      return
    }
    let cancelled = false
    getAttendanceDays(studentId, from, to)
      .then((days) => { if (!cancelled) setAttendanceDays(days) })
      .catch(() => { if (!cancelled) setAttendanceDays(null) })
    return () => { cancelled = true }
  }, [studentId, from, to])

  function handleClassChange(v: string | null) {
    setClassId(v ?? "")
    setStudentId("")
  }

  function downloadPdf() {
    if (!studentId) return
    startTransition(async () => {
      try {
        const res = await fetch("/api/report-cards/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, from, to, teacherNotes }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error ?? "خطأ في إنشاء PDF")
          return
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `تقرير-${student?.fullName ?? ""}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        toast.success("تم تحميل PDF")
      } catch {
        toast.error("خطأ في إنشاء PDF")
      }
    })
  }

  function sendWhatsApp() {
    if (!student?.guardianPhone) return
    const body = buildTextSummary()
    const phone = student.guardianPhone.replace(/\D/g, "").replace(/^00/, "")
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`
    window.open(url, "_blank")

    startSend(async () => {
      try {
        await saveMessageLog({ studentId, channel: "INDIVIDUAL", mode: "TEMPLATE", body })
      } catch {
        // Non-blocking
      }
    })
  }

  function buildSurahRangeText() {
    if (!student) return ""
    if (student.fromSurahName && student.fromAyah && student.toSurahName && student.toAyah) {
      return `من سورة ${student.fromSurahName} آية ${student.fromAyah} إلى سورة ${student.toSurahName} آية ${student.toAyah}`
    }
    return ""
  }

  function buildTextSummary() {
    if (!student) return ""
    const surahRange = buildSurahRangeText()
    return [
      `📊 كشف متابعة الطالب: ${student.fullName}`,
      `📅 الفترة: ${from} — ${to}`,
      `📚 المحفوظ الإجمالي: ${student.totalPages} صفحة`,
      surahRange ? `📖 ${surahRange}` : "",
      attendanceDays !== null ? `✅ أيام الحضور في الفترة: ${attendanceDays} يوم` : "",
      `🏫 الحلقة: ${student.className ?? ""}`,
      `👨‍🏫 المعلم: ${student.teacherName ?? ""}`,
      teacherNotes ? `📝 ملاحظات المعلم: ${teacherNotes}` : "",
      `بارك الله فيكم`,
    ]
      .filter(Boolean)
      .join("\n")
  }

  const surahRangeText = buildSurahRangeText()
  const pageRangeText = student?.pageFrom && student?.pageTo
    ? `من صفحة ${student.pageFrom} إلى صفحة ${student.pageTo}`
    : student?.totalPages
      ? `${student.totalPages} صفحة`
      : "—"

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">اختر الحلقة والطالب والفترة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Class filter */}
          <div className="space-y-1">
            <Label>الحلقة</Label>
            <Select
              value={classId}
              onValueChange={handleClassChange}
              items={[{ value: "", label: "الكل — جميع الحلقات" }, ...classes.map((c) => ({ value: c.id, label: c.name }))]}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="الكل — جميع الحلقات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">الكل — جميع الحلقات</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Student filter */}
          <div className="space-y-1">
            <Label>الطالب</Label>
            <Select
              value={studentId}
              onValueChange={(v) => setStudentId(v ?? "")}
              items={filteredStudents.map((s) => ({ value: s.id, label: s.fullName + (!classId && s.className ? ` — ${s.className}` : "") }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="اختر الطالب" />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName}
                    {!classId && s.className ? ` — ${s.className}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>من</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>إلى</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {student && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">معاينة الكشف</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              {student.className && (
                <Badge variant="outline">{student.className}</Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">اسم الطالب</span>
                <span className="font-medium">{student.fullName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">الحلقة</span>
                <span className="font-medium">{student.className ?? "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">المعلم</span>
                <span className="font-medium">{student.teacherName ?? "—"}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">إجمالي المحفوظ</span>
                <span className="font-medium text-green-700">{student.totalPages} صفحة</span>
              </div>
              {surahRangeText && (
                <div className="flex justify-between border-b pb-2 col-span-2">
                  <span className="text-muted-foreground">نطاق المحفوظ</span>
                  <span className="font-medium text-green-700 text-left">{surahRangeText}</span>
                </div>
              )}
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">الفترة</span>
                <span className="font-medium">{from} — {to}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">أيام الحضور</span>
                <span className="font-medium text-blue-700">
                  {attendanceDays !== null ? `${attendanceDays} يوم` : "…"}
                </span>
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <Label>ملاحظات المعلم (اختياري)</Label>
              <Textarea
                value={teacherNotes}
                onChange={(e) => setTeacherNotes(e.target.value)}
                rows={3}
                placeholder="أدخل ملاحظاتك هنا…"
                dir="rtl"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button onClick={downloadPdf} disabled={isPending} className="gap-2">
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                تحميل PDF
              </Button>
              {student.guardianPhone && (
                <Button
                  variant="outline"
                  onClick={sendWhatsApp}
                  disabled={isSending}
                  className="gap-2"
                >
                  <Send className="h-4 w-4" />
                  إرسال عبر واتساب
                </Button>
              )}
              {!student.guardianPhone && (
                <p className="text-xs text-muted-foreground self-center">
                  لا يوجد رقم ولي أمر مسجّل
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

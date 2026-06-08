"use client"

import { useState, useTransition } from "react"
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
import { saveMessageLog } from "@/lib/actions/messages.actions"

type Student = {
  id: string
  fullName: string
  guardianPhone: string | null
  guardianName: string | null
  className: string | null
  teacherName: string | null
  totalPages: number
}

type Props = {
  students: Student[]
}

const now = new Date()
const DEFAULT_FROM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
const DEFAULT_TO = now.toISOString().slice(0, 10)

export function ReportCardsClient({ students }: Props) {
  const [studentId, setStudentId] = useState("")
  const [from, setFrom] = useState(DEFAULT_FROM)
  const [to, setTo] = useState(DEFAULT_TO)
  const [teacherNotes, setTeacherNotes] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isSending, startSend] = useTransition()

  const student = students.find((s) => s.id === studentId)

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
        a.click()
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
    const phone = student.guardianPhone.replace("+", "")
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(body)}`
    window.open(url, "_blank")

    startSend(async () => {
      try {
        await saveMessageLog({
          studentId,
          channel: "INDIVIDUAL",
          mode: "TEMPLATE",
          body,
        })
      } catch {
        // Non-blocking
      }
    })
  }

  function buildTextSummary() {
    if (!student) return ""
    return [
      `📊 كشف متابعة الطالب: ${student.fullName}`,
      `📅 الفترة: ${from} — ${to}`,
      `📚 إجمالي المحفوظ: ${student.totalPages} صفحة`,
      `🏫 الحلقة: ${student.className ?? ""}`,
      `👨‍🏫 المعلم: ${student.teacherName ?? ""}`,
      teacherNotes ? `📝 ملاحظات المعلم: ${teacherNotes}` : "",
      `بارك الله فيكم 🤲`,
    ]
      .filter(Boolean)
      .join("\n")
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">اختر الطالب والفترة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>الطالب</Label>
            <Select value={studentId} onValueChange={(v) => { if (v != null) setStudentId(v) }}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الطالب" />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.fullName}
                    {s.className ? ` — ${s.className}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              <div className="flex justify-between border-b pb-2 col-span-2">
                <span className="text-muted-foreground">الفترة</span>
                <span className="font-medium">{from} — {to}</span>
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

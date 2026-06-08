"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Copy, Send, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { getGroupReportData, saveMessageLog } from "@/lib/actions/messages.actions"

type Category = {
  id: string
  name: string
  tone: string
  template: string
}

type StudentOption = {
  id: string
  fullName: string
  guardianPhone: string | null
  guardianName: string | null
  classId: string | null
  className: string | null
  teacherName: string | null
  totalPages: number
  lastSession: {
    date: string
    attendanceStatus: string | null
    newEntry: { fromPage: number; toPage: number; rating: number; mistakeCount: number } | null
    revEntry: { fromPage: number; toPage: number } | null
  } | null
}

type ClassOption = {
  id: string
  name: string
}

type Props = {
  categories: Category[]
  students: StudentOption[]
  classes: ClassOption[]
  userName: string
}

const RATING_AR = ["", "يحتاج إعادة", "جيد", "جيد جداً", "ممتاز"]
const ATT_AR: Record<string, string> = {
  PRESENT: "حاضر",
  ABSENT: "غائب",
  LATE: "متأخر",
  EXCUSED: "معذور",
}

function fillTemplate(template: string, student: StudentOption, date: string, teacherName: string) {
  const last = student.lastSession
  const sabaq = last?.newEntry
    ? `من صفحة ${last.newEntry.fromPage} إلى ${last.newEntry.toPage}`
    : "لا يوجد"
  const rev = last?.revEntry
    ? `من صفحة ${last.revEntry.fromPage} إلى ${last.revEntry.toPage}`
    : "لا يوجد"
  const rating = last?.newEntry ? (RATING_AR[last.newEntry.rating] ?? "") : ""
  const mistakes = String(last?.newEntry?.mistakeCount ?? 0)
  const att = ATT_AR[last?.attendanceStatus ?? "PRESENT"] ?? "حاضر"

  return template
    .replace(/{student_name}/g, student.fullName)
    .replace(/{guardian_name}/g, student.guardianName ?? "ولي الأمر")
    .replace(/{class_name}/g, student.className ?? "")
    .replace(/{teacher_name}/g, teacherName)
    .replace(/{date}/g, date)
    .replace(/{today_sabaq}/g, sabaq)
    .replace(/{today_revision}/g, rev)
    .replace(/{rating}/g, rating)
    .replace(/{mistakes}/g, mistakes)
    .replace(/{attendance_status}/g, att)
    .replace(/{total_memorized}/g, String(student.totalPages))
}

// ── Mode A — Group report ─────────────────────────────────────────────────────

function GroupReportTab({ classes }: { classes: ClassOption[] }) {
  const [classId, setClassId] = useState("")
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [text, setText] = useState("")
  const [isPending, startTransition] = useTransition()

  function generate() {
    if (!classId || !date) return
    startTransition(async () => {
      try {
        const result = await getGroupReportData(classId, date)
        setText(result.text)
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "خطأ")
      }
    })
  }

  function copy() {
    navigator.clipboard.writeText(text)
    toast.success("تم النسخ")
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>الحلقة</Label>
          <Select value={classId} onValueChange={(v) => { if (v != null) setClassId(v) }}>
            <SelectTrigger>
              <SelectValue placeholder="اختر الحلقة" />
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
        <div className="space-y-1">
          <Label>التاريخ</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <Button onClick={generate} disabled={!classId || isPending} className="gap-2">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        توليد التقرير
      </Button>

      {text && (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="font-mono text-sm"
            dir="rtl"
          />
          <Button variant="outline" className="gap-2" onClick={copy}>
            <Copy className="h-4 w-4" />
            نسخ
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Mode B — Individual message ───────────────────────────────────────────────

function IndividualMessageTab({
  categories,
  students,
  userName,
}: {
  categories: Category[]
  students: StudentOption[]
  userName: string
}) {
  const [categoryId, setCategoryId] = useState("")
  const [studentId, setStudentId] = useState("")
  const [mode, setMode] = useState<"TEMPLATE" | "AI">("TEMPLATE")
  const [text, setText] = useState("")
  const [aiNotice, setAiNotice] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isSaving, startSave] = useTransition()

  const category = categories.find((c) => c.id === categoryId)
  const student = students.find((s) => s.id === studentId)

  function generate() {
    if (!category || !student) return
    const today = new Date().toISOString().slice(0, 10)

    if (mode === "TEMPLATE") {
      setText(fillTemplate(category.template, student, today, userName))
      setAiNotice("")
      return
    }

    // AI mode
    startTransition(async () => {
      setAiNotice("")
      try {
        const res = await fetch("/api/messages/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, categoryId }),
        })
        const data = await res.json()
        if (data.fallback || !data.text) {
          // Fall back to template
          setText(fillTemplate(category.template, student, today, userName))
          setAiNotice("تعذّر الاتصال بخدمة الذكاء الاصطناعي — تم استخدام القالب تلقائياً")
        } else {
          setText(data.text)
        }
      } catch {
        setText(fillTemplate(category.template, student, today, userName))
        setAiNotice("تعذّر الاتصال بخدمة الذكاء الاصطناعي — تم استخدام القالب تلقائياً")
      }
    })
  }

  function copy() {
    navigator.clipboard.writeText(text)
    toast.success("تم النسخ")
  }

  function send() {
    if (!student?.guardianPhone || !text) return
    const phone = student.guardianPhone.replace("+", "")
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
    window.open(url, "_blank")
    // Save log
    startSave(async () => {
      try {
        await saveMessageLog({
          studentId,
          categoryId,
          channel: "INDIVIDUAL",
          mode: aiNotice ? "TEMPLATE" : mode,
          body: text,
        })
      } catch {
        // Non-blocking
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>الفئة</Label>
          <Select value={categoryId} onValueChange={(v) => { if (v != null) setCategoryId(v) }}>
            <SelectTrigger>
              <SelectValue placeholder="اختر الفئة" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2 items-center">
        <Label>الوضع:</Label>
        <Button
          variant={mode === "TEMPLATE" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("TEMPLATE")}
        >
          قالب
        </Button>
        <Button
          variant={mode === "AI" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("AI")}
        >
          ذكاء اصطناعي
        </Button>
      </div>

      <Button
        onClick={generate}
        disabled={!categoryId || !studentId || isPending}
        className="gap-2"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        توليد الرسالة
      </Button>

      {aiNotice && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {aiNotice}
        </div>
      )}

      {text && (
        <div className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="text-sm"
            dir="rtl"
          />
          <div className="flex gap-2 flex-wrap">
            {student?.guardianPhone && (
              <Button onClick={send} disabled={isSaving} className="gap-2">
                <Send className="h-4 w-4" />
                إرسال عبر واتساب
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={copy}>
              <Copy className="h-4 w-4" />
              نسخ
            </Button>
          </div>
          {student && !student.guardianPhone && (
            <p className="text-xs text-muted-foreground">
              لا يوجد رقم ولي أمر مسجّل لهذا الطالب
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function MessagesClient({ categories, students, classes, userName }: Props) {
  return (
    <Tabs defaultValue="group" dir="rtl">
      <TabsList className="mb-4">
        <TabsTrigger value="group">تقرير المجموعة</TabsTrigger>
        <TabsTrigger value="individual">رسالة فردية</TabsTrigger>
      </TabsList>

      <TabsContent value="group">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">تقرير الجلسة اليومية</CardTitle>
            <p className="text-sm text-muted-foreground">
              اختر الحلقة والتاريخ لتوليد ملخص جاهز للصق في مجموعة الواتساب
            </p>
          </CardHeader>
          <CardContent>
            <GroupReportTab classes={classes} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="individual">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">رسالة فردية لولي الأمر</CardTitle>
            <p className="text-sm text-muted-foreground">
              اختر فئة الرسالة والطالب، ثم أرسل عبر واتساب أو انسخ
            </p>
          </CardHeader>
          <CardContent>
            <IndividualMessageTab
              categories={categories}
              students={students}
              userName={userName}
            />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

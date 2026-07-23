"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronRight, ChevronLeft, Loader2, CalendarDays } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { formatMonthYear } from "@/lib/date"
import {
  getCalendarDayStates,
  getCalendarClasses,
  type DayInfo,
  type CalendarClass,
  type CalendarTeacher,
} from "@/lib/actions/calendar.actions"

// ─── Constants ────────────────────────────────────────────────────────────────

// Day headers right-to-left in Arabic (Sunday first, the Saudi calendar convention)
const DAY_HEADERS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addMonths(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(monthStr: string): string {
  const [y, m] = monthStr.split("-").map(Number)
  return formatMonthYear(new Date(y, m - 1, 1))
}

// For the first day of the month: getDay() gives 0=Sun .. 6=Sat
// In RTL CSS Grid, column 1 is rightmost (= Sunday).
// So gridColumnStart = jsDay + 1 maps correctly.
function firstDayColumn(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay() + 1
}

// ─── Cell styling ─────────────────────────────────────────────────────────────

function getCellStyle(day: DayInfo) {
  const base = "relative flex flex-col items-center justify-center rounded-lg min-h-[52px] text-sm font-medium select-none"
  const ring = day.isToday ? "ring-2 ring-blue-500 ring-offset-1" : ""

  let bg = ""
  let text = ""
  let cursor = "cursor-default"

  switch (day.status) {
    case "NO_CLASS":
      bg = "bg-transparent hover:bg-muted/30"
      text = "text-muted-foreground/40"
      cursor = "cursor-pointer"
      break
    case "COMPLETE":
      bg = "bg-green-100 hover:bg-green-200"
      text = "text-green-800"
      cursor = "cursor-pointer"
      break
    case "MISSED":
      bg = "bg-red-100 hover:bg-red-200"
      text = "text-red-800"
      cursor = "cursor-pointer"
      break
    case "UPCOMING":
      bg = "bg-muted/40"
      text = "text-muted-foreground/50"
      break
    case "EMPTY": // today, class day, no records yet
      bg = "bg-blue-50 hover:bg-blue-100"
      text = "text-blue-800"
      cursor = "cursor-pointer"
      break
  }

  return cn(base, bg, text, ring, cursor)
}

function StatusDot({ status }: { status: DayInfo["status"] }) {
  if (status === "NO_CLASS" || status === "UPCOMING") return null
  const color =
    status === "COMPLETE"
      ? "bg-green-500"
      : status === "MISSED"
      ? "bg-red-500"
      : "bg-blue-400" // EMPTY = today, no records yet
  return <span className={cn("block w-1.5 h-1.5 rounded-full mt-0.5", color)} />
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  days,
  classId,
  year,
  month,
}: {
  days: DayInfo[]
  classId: string
  year: number
  month: number
}) {
  const col1 = firstDayColumn(year, month)
  const isTappable = (d: DayInfo) => !d.isFuture && d.status !== "UPCOMING"

  return (
    <div className="space-y-2">
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="text-xs text-muted-foreground font-medium py-1">
            {h}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const style = getCellStyle(d)
          const tappable = isTappable(d)
          const href = `/daily?classId=${classId}&date=${d.date}`

          return (
            <div
              key={d.date}
              style={i === 0 ? { gridColumnStart: col1 } : undefined}
            >
              {tappable ? (
                <Link href={href} className={cn(style, "block")}>
                  <span>{d.day}</span>
                  <StatusDot status={d.status} />
                </Link>
              ) : (
                <div className={style}>
                  <span>{d.day}</span>
                  <StatusDot status={d.status} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: "bg-green-500", label: "مكتمل" },
    { color: "bg-red-500", label: "فاته التسجيل" },
    { color: "bg-blue-400", label: "اليوم" },
    { color: "bg-muted-foreground/20", label: "لا يوجد حصة" },
  ]
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center text-xs text-muted-foreground pt-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={cn("inline-block w-2.5 h-2.5 rounded-full shrink-0", item.color)} />
          {item.label}
        </span>
      ))}
    </div>
  )
}

// ─── Main client component ────────────────────────────────────────────────────

export function CalendarClient({
  role,
  teachers,
  initialClasses,
  initialClassId,
  initialMonth,
  initialTeacherId,
}: {
  role: string
  teachers: CalendarTeacher[]
  initialClasses: CalendarClass[]
  initialClassId: string
  initialMonth: string
  initialTeacherId: string
}) {
  const [teacherId, setTeacherId] = useState(initialTeacherId)
  const [classes, setClasses] = useState<CalendarClass[]>(initialClasses)
  const [classId, setClassId] = useState(initialClassId || initialClasses[0]?.id || "")
  const [month, setMonth] = useState(initialMonth)
  const [days, setDays] = useState<DayInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [classesLoading, setClassesLoading] = useState(false)

  const [year, monthNum] = month.split("-").map(Number)

  // Load day states whenever classId or month changes
  const loadDays = useCallback(async (cid: string, y: number, m: number) => {
    if (!cid) { setDays([]); return }
    setLoading(true)
    try {
      const data = await getCalendarDayStates(cid, y, m)
      setDays(data)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تحميل التقويم")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDays(classId, year, monthNum)
  }, [classId, year, monthNum, loadDays])

  // When teacher changes, refetch classes
  const handleTeacherChange = async (tid: string) => {
    setTeacherId(tid)
    setClassesLoading(true)
    try {
      const data = await getCalendarClasses(tid || undefined)
      setClasses(data)
      const first = data[0]?.id ?? ""
      setClassId(first)
    } catch {
      toast.error("فشل تحميل الحلقات")
    } finally {
      setClassesLoading(false)
    }
  }

  const prevMonth = () => setMonth((m) => addMonths(m, -1))
  const nextMonth = () => setMonth((m) => addMonths(m, 1))

  const now = new Date()
  const todayMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const isFutureMonth = month > todayMonth

  return (
    <div className="space-y-4">
      {/* Teacher selector — principal only */}
      {role === "PRINCIPAL" && teachers.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-sm">المعلم</Label>
          <Select
            value={teacherId}
            onValueChange={(v) => handleTeacherChange(v ?? "")}
            items={[{ value: "", label: "كل المعلمين" }, ...teachers.map((t) => ({ value: t.id, label: t.fullName }))]}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="كل المعلمين" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">كل المعلمين</SelectItem>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Class selector */}
      <div className="space-y-1.5">
        <Label className="text-sm">الحلقة</Label>
        {classesLoading ? (
          <div className="h-11 flex items-center px-3 border rounded-md text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin me-2" /> جارٍ التحميل…
          </div>
        ) : (
          <Select
            value={classId}
            onValueChange={(v) => setClassId(v ?? "")}
            items={classes.map((c) => ({ value: c.id, label: c.teacher ? `${c.name} — ${c.teacher.fullName}` : c.name }))}
          >
            <SelectTrigger className="h-11">
              <SelectValue placeholder="اختر حلقة" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.teacher && (
                    <span className="text-muted-foreground"> — {c.teacher.fullName}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!classId ? (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <CalendarDays className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-sm font-medium">اختر حلقة لعرض التقويم</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          {/* Month navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={prevMonth}
              disabled={loading}
              aria-label="الشهر السابق"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>

            <h2 className="text-base font-semibold">{monthLabel(month)}</h2>

            <Button
              variant="ghost"
              size="icon"
              onClick={nextMonth}
              disabled={loading || isFutureMonth}
              aria-label="الشهر التالي"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </div>

          {/* Calendar body */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CalendarGrid days={days} classId={classId} year={year} month={monthNum} />
          )}

          {/* Legend */}
          <Legend />
        </div>
      )}
    </div>
  )
}

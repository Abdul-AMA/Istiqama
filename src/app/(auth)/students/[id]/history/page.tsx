import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, BookOpen } from "lucide-react"
import { HistoryFilters } from "./history-filters"

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string; type?: string }>
}

const RATING_LABELS: Record<number, string> = {
  4: "ممتاز", 3: "جيد جداً", 2: "جيد", 1: "يحتاج إعادة",
}
const RATING_COLORS: Record<number, string> = {
  4: "bg-green-100 text-green-800",
  3: "bg-blue-100 text-blue-800",
  2: "bg-yellow-100 text-yellow-800",
  1: "bg-red-100 text-red-800",
}
const TYPE_LABELS: Record<string, string> = {
  NEW: "جديد",
  RECENT_REVISION: "مراجعة قريبة",
  OLD_REVISION: "مراجعة بعيدة",
}
const TYPE_COLORS: Record<string, string> = {
  NEW: "bg-purple-100 text-purple-800",
  RECENT_REVISION: "bg-blue-100 text-blue-800",
  OLD_REVISION: "bg-gray-100 text-gray-800",
}
const ATT_LABELS: Record<string, string> = {
  PRESENT: "حاضر", ABSENT: "غائب", LATE: "متأخر", EXCUSED: "معذور",
}
const ATT_COLORS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-800",
  ABSENT: "bg-red-100 text-red-800",
  LATE: "bg-yellow-100 text-yellow-800",
  EXCUSED: "bg-blue-100 text-blue-800",
}

function toUtcDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

export default async function StudentHistoryPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const session = await auth()
  const role = session!.user.role!
  const userId = session!.user.id!

  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true, fullName: true, classId: true },
  })
  if (!student) notFound()

  if (role === "TEACHER" && student.classId) {
    const cls = await prisma.class.findFirst({
      where: { id: student.classId, teacherId: userId },
    })
    if (!cls) redirect("/dashboard")
  }

  const fromDate = sp.from ? new Date(sp.from) : undefined
  const toDate = sp.to ? new Date(sp.to) : undefined
  const typeFilter = (sp.type && sp.type !== "ALL")
    ? (sp.type as "NEW" | "RECENT_REVISION" | "OLD_REVISION")
    : undefined

  const dateFilter = fromDate || toDate
    ? { date: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } }
    : {}

  const [hifzSessions, attendanceRecords, surahs] = await Promise.all([
    prisma.hifzSession.findMany({
      where: { studentId: id, ...dateFilter },
      include: {
        entries: typeFilter ? { where: { type: typeFilter } } : true,
      },
      orderBy: { date: "desc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: id, ...dateFilter },
      select: { date: true, status: true, notes: true },
      orderBy: { date: "desc" },
    }),
    prisma.surah.findMany({ orderBy: { number: "asc" } }),
  ])

  // Attendance map: YYYY-MM-DD → record
  const attendanceMap = new Map(
    attendanceRecords.map((r) => [toUtcDateStr(r.date), r])
  )

  // Attendance summary
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
  for (const r of attendanceRecords) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++
  }

  function getSurahLabel(from: number, to: number): string {
    const inRange = surahs.filter((s) => s.startPage >= from && s.startPage <= to)
    if (inRange.length === 0) {
      const surah = [...surahs].reverse().find((s) => s.startPage <= from)
      return surah?.nameAr ?? ""
    }
    if (inRange.length <= 2) return inRange.map((s) => s.nameAr).join("، ")
    return `${inRange[0].nameAr} — ${inRange[inRange.length - 1].nameAr}`
  }

  function formatDate(d: Date) {
    return new Date(d).toLocaleDateString("ar-SA", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    })
  }

  const totalAttendance = attendanceRecords.length
  const presentCount = counts.PRESENT + counts.LATE
  const attendancePct = totalAttendance > 0
    ? Math.round((presentCount / totalAttendance) * 100)
    : null

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/students/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">سجل {student.fullName}</h1>
          <p className="text-sm text-muted-foreground">التاريخ الكامل للحضور والحفظ</p>
        </div>
      </div>

      {/* Attendance summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-green-50 p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{counts.PRESENT}</p>
          <p className="text-xs text-muted-foreground mt-0.5">حاضر</p>
        </div>
        <div className="rounded-lg border bg-red-50 p-3 text-center">
          <p className="text-2xl font-bold text-red-700">{counts.ABSENT}</p>
          <p className="text-xs text-muted-foreground mt-0.5">غائب</p>
        </div>
        <div className="rounded-lg border bg-yellow-50 p-3 text-center">
          <p className="text-2xl font-bold text-yellow-700">{counts.LATE}</p>
          <p className="text-xs text-muted-foreground mt-0.5">متأخر</p>
        </div>
        <div className="rounded-lg border bg-blue-50 p-3 text-center">
          <p className="text-2xl font-bold text-blue-700">{counts.EXCUSED}</p>
          <p className="text-xs text-muted-foreground mt-0.5">معذور</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-2xl font-bold">
            {attendancePct !== null ? `${attendancePct}%` : "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">نسبة الحضور</p>
        </div>
      </div>

      {/* Filters */}
      <HistoryFilters
        studentId={id}
        defaultFrom={sp.from ?? ""}
        defaultTo={sp.to ?? ""}
        defaultType={sp.type ?? "ALL"}
      />

      {/* Timeline */}
      {hifzSessions.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center text-muted-foreground space-y-2">
            <BookOpen className="h-10 w-10 mx-auto opacity-30" />
            <p className="text-sm font-medium">لم يتم تسجيل أي جلسات بعد</p>
            {(sp.from || sp.to || sp.type) && (
              <p className="text-xs">جرب تغيير نطاق التواريخ أو نوع التصفية</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {hifzSessions.map((session) => {
          const dateKey = toUtcDateStr(session.date)
          const attendance = attendanceMap.get(dateKey)
          return (
            <Card key={session.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-medium">
                    {formatDate(session.date)}
                  </CardTitle>
                  {attendance && (
                    <Badge className={ATT_COLORS[attendance.status] ?? ""}>
                      {ATT_LABELS[attendance.status] ?? attendance.status}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {session.entries.length === 0 && (
                  <p className="text-sm text-muted-foreground">لا توجد تسميعات مسجلة</p>
                )}
                {session.entries.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={TYPE_COLORS[entry.type] ?? ""}>
                        {TYPE_LABELS[entry.type] ?? entry.type}
                      </Badge>
                      <span className="text-sm font-medium" dir="ltr">
                        ص {entry.fromPage}–{entry.toPage}
                      </span>
                      <Badge className={RATING_COLORS[entry.rating] ?? ""}>
                        {RATING_LABELS[entry.rating] ?? entry.rating}
                      </Badge>
                      {entry.mistakeCount > 0 && (
                        <span className="text-xs text-red-600">
                          {entry.mistakeCount} أخطاء
                        </span>
                      )}
                    </div>
                    {(entry.fromPage || entry.toPage) && (
                      <p className="text-xs text-muted-foreground">
                        {getSurahLabel(entry.fromPage, entry.toPage)}
                      </p>
                    )}
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground">{entry.notes}</p>
                    )}
                  </div>
                ))}
                {session.generalNotes && (
                  <p className="text-sm text-muted-foreground border-t pt-2 mt-2">
                    ملاحظات: {session.generalNotes}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { BarChart3 } from "lucide-react"
import { ReportClient, type StudentRow, type Coverage } from "../classes/[id]/report/report-client"
import { ClassPicker } from "./class-picker"

type Props = {
  searchParams: Promise<{ classId?: string; from?: string; to?: string }>
}

const DOW_TO_JS: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
}

function toUtcDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

export default async function ReportPage({ searchParams }: Props) {
  const sp = await searchParams
  const session = await auth()
  const role = session!.user.role!
  const userId = session!.user.id!

  // Classes scoped to role (for the picker)
  const allClasses = await prisma.class.findMany({
    where: role === "PRINCIPAL"
      ? { status: "ACTIVE" }
      : { teacherId: userId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  const classId = sp.classId ?? ""
  const selectedClass = classId
    ? await prisma.class.findUnique({
        where: { id: classId },
        select: {
          id: true, name: true, teacherId: true,
          teacher: { select: { fullName: true } },
          scheduleSlots: { select: { dayOfWeek: true } },
          students: {
            where: { status: { in: ["ACTIVE", "GUEST"] } },
            select: { id: true, fullName: true, photoUrl: true, status: true, currentTotalPagesMemorized: true },
            orderBy: { fullName: "asc" },
          },
        },
      })
    : null

  // Access guard
  if (selectedClass && role === "TEACHER" && selectedClass.teacherId !== userId) {
    redirect("/report")
  }

  let reportStudents: StudentRow[] = []
  let coverage: Coverage = { complete: 0, partial: 0, missed: 0, total: 0 }
  let reportFrom = ""
  let reportTo = ""

  if (selectedClass) {
    const now = new Date()
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
    const defaultTo = toUtcDateStr(now)
    reportFrom = sp.from ?? defaultFrom
    reportTo = sp.to ?? defaultTo

    const fromDate = new Date(reportFrom)
    const toDate = new Date(reportTo)
    const studentIds = selectedClass.students.map((s) => s.id)
    const rosterCount = studentIds.length
    const fourWeeksAgo = new Date(now)
    fourWeeksAgo.setDate(now.getDate() - 28)

    const [attendanceInRange, hifzInRange, velocityEntries, lastSessions] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where: { studentId: { in: studentIds }, date: { gte: fromDate, lte: toDate } },
        select: { studentId: true, status: true },
      }),
      prisma.hifzSession.findMany({
        where: { studentId: { in: studentIds }, date: { gte: fromDate, lte: toDate } },
        select: { studentId: true, date: true, entries: { select: { rating: true } } },
      }),
      prisma.recitationEntry.findMany({
        where: {
          type: "NEW",
          hifzSession: { studentId: { in: studentIds }, date: { gte: fourWeeksAgo } },
        },
        select: {
          pagesCount: true, fromPage: true, toPage: true,
          hifzSession: { select: { studentId: true } },
        },
      }),
      prisma.hifzSession.findMany({
        where: { studentId: { in: studentIds } },
        select: { studentId: true, date: true },
        orderBy: { date: "desc" },
      }),
    ])

    const attByStudent = new Map<string, { total: number; present: number }>()
    for (const r of attendanceInRange) {
      const ex = attByStudent.get(r.studentId) ?? { total: 0, present: 0 }
      ex.total++
      if (r.status === "PRESENT" || r.status === "LATE") ex.present++
      attByStudent.set(r.studentId, ex)
    }

    const ratingsByStudent = new Map<string, number[]>()
    for (const s of hifzInRange) {
      const ex = ratingsByStudent.get(s.studentId) ?? []
      for (const e of s.entries) ex.push(e.rating)
      ratingsByStudent.set(s.studentId, ex)
    }

    const velocityByStudent = new Map<string, number>()
    for (const e of velocityEntries) {
      const sid = e.hifzSession.studentId
      const pages = e.pagesCount ?? (e.toPage - e.fromPage + 1)
      velocityByStudent.set(sid, (velocityByStudent.get(sid) ?? 0) + pages)
    }

    const lastSessionByStudent = new Map<string, string>()
    for (const s of lastSessions) {
      if (!lastSessionByStudent.has(s.studentId)) {
        lastSessionByStudent.set(s.studentId, toUtcDateStr(s.date))
      }
    }

    reportStudents = selectedClass.students.map((s) => {
      const att = attByStudent.get(s.id)
      const ratings = ratingsByStudent.get(s.id) ?? []
      const velocityPages = velocityByStudent.get(s.id) ?? 0
      return {
        id: s.id,
        fullName: s.fullName,
        photoUrl: s.photoUrl,
        status: s.status,
        totalPages: s.currentTotalPagesMemorized,
        attendanceRate: att && att.total > 0 ? Math.round((att.present / att.total) * 100) : null,
        avgRating: ratings.length > 0 ? ratings.reduce((sum, r) => sum + r, 0) / ratings.length : null,
        lastSessionDate: lastSessionByStudent.get(s.id) ?? null,
        velocity: velocityPages / 4,
      }
    })

    // Session coverage
    const classDaysOfWeek = new Set(selectedClass.scheduleSlots.map((s) => DOW_TO_JS[s.dayOfWeek]))
    const allAttInRange = await prisma.attendanceRecord.findMany({
      where: { classId, date: { gte: fromDate, lte: toDate } },
      select: { date: true, studentId: true },
    })
    const recordsByDate = new Map<string, Set<string>>()
    for (const r of allAttInRange) {
      const key = toUtcDateStr(r.date)
      if (!recordsByDate.has(key)) recordsByDate.set(key, new Set())
      recordsByDate.get(key)!.add(r.studentId)
    }
    const todayStr = toUtcDateStr(now)
    const cursor = new Date(fromDate)
    while (cursor <= toDate) {
      const dateStr = toUtcDateStr(cursor)
      if (classDaysOfWeek.has(cursor.getUTCDay()) && dateStr <= todayStr) {
        coverage.total++
        const count = recordsByDate.get(dateStr)?.size ?? 0
        if (count === 0) coverage.missed++
        else if (rosterCount > 0 && count >= rosterCount) coverage.complete++
        else coverage.partial++
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          التقارير
        </h1>
        <p className="text-sm text-muted-foreground mt-1">اختر الحلقة لعرض تقرير أداء الطلاب</p>
      </div>

      <ClassPicker
        classes={allClasses}
        selectedClassId={classId}
        from={reportFrom}
        to={reportTo}
      />

      {selectedClass ? (
        <ReportClient
          classId={selectedClass.id}
          students={reportStudents}
          coverage={coverage}
          from={reportFrom}
          to={reportTo}
          filterPath={`/report?classId=${selectedClass.id}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground space-y-3">
          <BarChart3 className="h-12 w-12 opacity-20" />
          <p className="text-base font-medium">اختر حلقة من القائمة أعلاه</p>
        </div>
      )}
    </div>
  )
}

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import {
  BookOpen, GraduationCap, Users, UserCheck,
  AlertTriangle, TrendingUp,
} from "lucide-react"
import { VelocityChart, type VelocityPoint } from "@/components/velocity-chart"
import { AttendanceChart, type AttendancePoint } from "@/components/attendance-chart"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toUtcDateStr(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

// ─── Teacher Dashboard ────────────────────────────────────────────────────────

async function TeacherDashboard({ userId, userName }: { userId: string; userName: string }) {
  const classes = await prisma.class.findMany({
    where: { teacherId: userId, status: "ACTIVE" },
    include: {
      students: {
        where: { status: { in: ["ACTIVE", "GUEST"] } },
        select: { id: true, fullName: true, photoUrl: true },
      },
    },
    orderBy: { name: "asc" },
  })

  const classIds = classes.map((c) => c.id)
  const studentIds = classes.flatMap((c) => c.students.map((s) => s.id))

  const oneWeekAgo = daysAgo(7)
  const twoWeeksAgo = daysAgo(14)
  const eightWeeksAgo = daysAgo(56)

  const [
    attThisWeek,
    att14Days,
    hifzThisWeek,
    velocityEntries,
  ] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { classId: { in: classIds }, date: { gte: oneWeekAgo } },
      select: { classId: true, studentId: true, status: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { studentId: { in: studentIds }, date: { gte: twoWeeksAgo } },
      select: { studentId: true, status: true },
    }),
    prisma.hifzSession.findMany({
      where: { classId: { in: classIds }, date: { gte: oneWeekAgo } },
      select: {
        studentId: true, classId: true,
        entries: { select: { rating: true, type: true } },
      },
    }),
    prisma.recitationEntry.findMany({
      where: {
        type: "NEW",
        hifzSession: { classId: { in: classIds }, date: { gte: eightWeeksAgo } },
      },
      select: {
        fromPage: true, toPage: true,
        hifzSession: { select: { classId: true, date: true } },
      },
    }),
  ])

  // Per-class stats this week
  const classStats = classes.map((cls) => {
    const att = attThisWeek.filter((r) => r.classId === cls.id)
    const present = att.filter((r) => r.status === "PRESENT" || r.status === "LATE").length
    const attRate = att.length > 0 ? Math.round((present / att.length) * 100) : null

    const sessions = hifzThisWeek.filter((s) => s.classId === cls.id)
    const entries = sessions.flatMap((s) => s.entries)
    const avgRating =
      entries.length > 0
        ? (entries.reduce((sum, e) => sum + e.rating, 0) / entries.length).toFixed(1)
        : null

    return { ...cls, attRate, avgRating }
  })

  // At-risk: students with no NEW entry in last 7 days
  const studentsWithNewHifz = new Set(
    hifzThisWeek
      .filter((s) => s.entries.some((e) => e.type === "NEW"))
      .map((s) => s.studentId)
  )

  // At-risk: students with attendance < 70% in last 14 days
  const attMap14 = new Map<string, { total: number; present: number }>()
  for (const r of att14Days) {
    const existing = attMap14.get(r.studentId) ?? { total: 0, present: 0 }
    existing.total++
    if (r.status === "PRESENT" || r.status === "LATE") existing.present++
    attMap14.set(r.studentId, existing)
  }

  type AtRiskStudent = {
    id: string; fullName: string; photoUrl: string | null
    className: string; classId: string
    noNewHifz: boolean; lowAttendance: boolean
  }

  const atRiskStudents: AtRiskStudent[] = []
  for (const cls of classes) {
    for (const s of cls.students) {
      const noNew = !studentsWithNewHifz.has(s.id)
      const attData = attMap14.get(s.id)
      const lowAtt = attData && attData.total > 0
        ? attData.present / attData.total < 0.7
        : false
      if (noNew || lowAtt) {
        atRiskStudents.push({
          id: s.id, fullName: s.fullName, photoUrl: s.photoUrl,
          className: cls.name, classId: cls.id,
          noNewHifz: noNew, lowAttendance: lowAtt,
        })
      }
    }
  }

  // Velocity chart: last 8 weeks
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = new Date(today)
    end.setUTCDate(today.getUTCDate() - i * 7)
    const start = new Date(end)
    start.setUTCDate(end.getUTCDate() - 6)
    return { start, end, label: i === 0 ? "هذا الأسبوع" : `أسبوع -${i}` }
  }).reverse()

  const velocityData: VelocityPoint[] = weeks.map((w) => {
    const point: VelocityPoint = { week: w.label }
    for (const cls of classes) {
      const pages = velocityEntries
        .filter((e) => {
          const d = e.hifzSession.date
          return e.hifzSession.classId === cls.id && d >= w.start && d <= w.end
        })
        .reduce((sum, e) => sum + (e.toPage - e.fromPage + 1), 0)
      point[cls.name] = pages
    }
    return point
  })

  const classNames = classes.map((c) => c.name)

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">لوحة المعلم</h1>
        <p className="text-muted-foreground mt-1">مرحباً، {userName}</p>
      </div>

      {/* Class cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classStats.map((cls) => (
          <Link key={cls.id} href={`/classes/${cls.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{cls.name}</p>
                  <BookOpen className="h-4 w-4 text-green-600" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xl font-bold">{cls.students.length}</p>
                    <p className="text-xs text-muted-foreground">طالب</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">
                      {cls.attRate != null ? `${cls.attRate}%` : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">حضور الأسبوع</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold">{cls.avgRating ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">تقييم الأسبوع</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/classes/${cls.id}/report`}
                    className="text-xs text-green-700 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    تقرير الحلقة
                  </Link>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {classStats.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              لم تُعيَّن لك حلقات بعد
            </CardContent>
          </Card>
        )}
      </div>

      {/* Velocity chart */}
      {classes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <CardTitle className="text-base">سرعة الحفظ — صفحات جديدة أسبوعياً</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <VelocityChart data={velocityData} classNames={classNames} />
          </CardContent>
        </Card>
      )}

      {/* At-risk students */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">
              الطلاب بحاجة للمتابعة
              {atRiskStudents.length > 0 && (
                <Badge variant="destructive" className="mr-2 text-xs">
                  {atRiskStudents.length}
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {atRiskStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              جميع الطلاب على المسار 👍
            </p>
          ) : (
            <div className="divide-y">
              {atRiskStudents.map((s) => (
                <Link
                  key={s.id}
                  href={`/students/${s.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-muted/40 px-2 rounded-lg -mx-2 transition-colors"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={s.photoUrl ?? undefined} alt={s.fullName} />
                    <AvatarFallback className="bg-orange-100 text-orange-800 text-xs font-semibold">
                      {s.fullName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">{s.className}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {s.noNewHifz && (
                      <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">
                        لا حفظ جديد — 7 أيام
                      </Badge>
                    )}
                    {s.lowAttendance && (
                      <Badge variant="outline" className="text-xs text-red-700 border-red-300">
                        حضور منخفض
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Principal Dashboard ──────────────────────────────────────────────────────

async function PrincipalDashboard({ userName }: { userName: string }) {
  const oneWeekAgo = daysAgo(7)
  const twoWeeksAgo = daysAgo(14)
  const thirtyDaysAgo = daysAgo(30)

  const [
    totalStudents,
    totalClasses,
    totalTeachers,
    totalPagesAgg,
    allClasses,
    last30DaysAtt,
    teacherHifzThisWeek,
    teacherLastActivity,
  ] = await Promise.all([
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.class.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "TEACHER", isActive: true } }),
    prisma.student.aggregate({
      where: { status: "ACTIVE" },
      _sum: { currentTotalPagesMemorized: true },
    }),
    prisma.class.findMany({
      where: { status: "ACTIVE" },
      include: {
        teacher: { select: { fullName: true } },
        students: {
          where: { status: { in: ["ACTIVE", "GUEST"] } },
          select: { id: true, currentTotalPagesMemorized: true },
        },
        scheduleSlots: { select: { dayOfWeek: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      select: { date: true, status: true },
    }),
    prisma.hifzSession.findMany({
      where: { date: { gte: oneWeekAgo } },
      select: { recordedByUserId: true },
    }),
    prisma.hifzSession.groupBy({
      by: ["recordedByUserId"],
      _max: { date: true },
    }),
  ])

  const totalPages = totalPagesAgg._sum.currentTotalPagesMemorized ?? 0

  // Attendance trend: last 30 days
  const attByDate = new Map<string, { total: number; present: number }>()
  for (const r of last30DaysAtt) {
    const key = toUtcDateStr(r.date)
    const existing = attByDate.get(key) ?? { total: 0, present: 0 }
    existing.total++
    if (r.status === "PRESENT" || r.status === "LATE") existing.present++
    attByDate.set(key, existing)
  }

  const attendanceTrend: AttendancePoint[] = []
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i)
    const key = toUtcDateStr(d)
    const data = attByDate.get(key)
    const rate = data && data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
    const label = `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
    if (data && data.total > 0) {
      attendanceTrend.push({ date: label, rate })
    }
  }

  // Per-class progress this month
  const now = new Date()
  now.setUTCHours(0, 0, 0, 0)
  const todayStr = toUtcDateStr(now)
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const DOW_TO_JS: Record<string, number> = {
    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
  }

  // Bulk attendance for all classes this month
  const allClassIds = allClasses.map((c) => c.id)
  const monthlyAtt = await prisma.attendanceRecord.findMany({
    where: { classId: { in: allClassIds }, date: { gte: monthStart } },
    select: { classId: true, date: true, status: true, studentId: true },
  })

  const monthlyAttByClass = new Map<
    string,
    Map<string, { recorded: Set<string> }>
  >()
  for (const r of monthlyAtt) {
    if (!monthlyAttByClass.has(r.classId))
      monthlyAttByClass.set(r.classId, new Map())
    const byDate = monthlyAttByClass.get(r.classId)!
    const key = toUtcDateStr(r.date)
    if (!byDate.has(key)) byDate.set(key, { recorded: new Set() })
    byDate.get(key)!.recorded.add(r.studentId)
  }

  const classProgress = allClasses.map((cls) => {
    const rosterCount = cls.students.length
    const avgPages =
      rosterCount > 0
        ? Math.round(
            cls.students.reduce((sum, s) => sum + s.currentTotalPagesMemorized, 0) /
              rosterCount
          )
        : 0

    // Attendance rate this month
    const attData = monthlyAtt.filter((r) => r.classId === cls.id)
    const presentCount = attData.filter(
      (r) => r.status === "PRESENT" || r.status === "LATE"
    ).length
    const attRate =
      attData.length > 0 ? Math.round((presentCount / attData.length) * 100) : null

    // Missed days this month
    const classDays = new Set(cls.scheduleSlots.map((s) => DOW_TO_JS[s.dayOfWeek]))
    const byDate = monthlyAttByClass.get(cls.id) ?? new Map()
    let missedDays = 0
    const cur = new Date(monthStart)
    while (cur <= now) {
      const key = toUtcDateStr(cur)
      if (classDays.has(cur.getUTCDay()) && key <= todayStr) {
        const recorded = byDate.get(key)?.recorded
        if (!recorded || recorded.size === 0) missedDays++
      }
      cur.setUTCDate(cur.getUTCDate() + 1)
    }

    return {
      id: cls.id, name: cls.name, teacherName: cls.teacher.fullName,
      rosterCount, avgPages, attRate, missedDays,
    }
  })

  // At-risk students across all classes
  // Need: attendance 14 days + recent hifz 7 days
  const allStudentIds = allClasses.flatMap((c) => c.students.map((s) => s.id))
  const studentDetails = await prisma.student.findMany({
    where: { id: { in: allStudentIds } },
    select: { id: true, fullName: true, photoUrl: true, classId: true },
  })

  const [att14All, hifz7All] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { studentId: { in: allStudentIds }, date: { gte: twoWeeksAgo } },
      select: { studentId: true, status: true },
    }),
    prisma.hifzSession.findMany({
      where: { studentId: { in: allStudentIds }, date: { gte: oneWeekAgo } },
      select: {
        studentId: true,
        entries: { where: { type: "NEW" }, select: { id: true } },
      },
    }),
  ])

  const studentsWithNewHifz7 = new Set(
    hifz7All.filter((s) => s.entries.length > 0).map((s) => s.studentId)
  )
  const attMap14All = new Map<string, { total: number; present: number }>()
  for (const r of att14All) {
    const ex = attMap14All.get(r.studentId) ?? { total: 0, present: 0 }
    ex.total++
    if (r.status === "PRESENT" || r.status === "LATE") ex.present++
    attMap14All.set(r.studentId, ex)
  }

  // Class lookup for at-risk
  const classById = new Map(allClasses.map((c) => [c.id, c]))

  type AtRiskEntry = {
    id: string; fullName: string; photoUrl: string | null
    className: string; teacherName: string
    noNewHifz: boolean; lowAttendance: boolean
  }

  const atRiskAll: AtRiskEntry[] = []
  for (const s of studentDetails) {
    const noNew = !studentsWithNewHifz7.has(s.id)
    const attData = attMap14All.get(s.id)
    const lowAtt = attData && attData.total > 0
      ? attData.present / attData.total < 0.7
      : false
    if (!noNew && !lowAtt) continue
    const cls = s.classId ? classById.get(s.classId) : null
    atRiskAll.push({
      id: s.id, fullName: s.fullName, photoUrl: s.photoUrl,
      className: cls?.name ?? "—",
      teacherName: cls?.teacher.fullName ?? "—",
      noNewHifz: noNew, lowAttendance: lowAtt,
    })
  }

  // Teacher activity
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER", isActive: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  })
  const sessionsByTeacher = new Map<string, number>()
  for (const s of teacherHifzThisWeek) {
    sessionsByTeacher.set(
      s.recordedByUserId,
      (sessionsByTeacher.get(s.recordedByUserId) ?? 0) + 1
    )
  }
  const lastActivityMap = new Map(
    teacherLastActivity.map((r) => [
      r.recordedByUserId,
      r._max.date ? toUtcDateStr(r._max.date) : null,
    ])
  )

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">لوحة المدير</h1>
        <p className="text-muted-foreground mt-1">مرحباً، {userName}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="الطلاب النشطون"
          value={totalStudents}
          icon={<GraduationCap className="h-5 w-5 text-purple-600" />}
          href="/students"
        />
        <StatCard
          title="الحلقات"
          value={totalClasses}
          icon={<BookOpen className="h-5 w-5 text-green-600" />}
          href="/classes"
        />
        <StatCard
          title="المعلمون"
          value={totalTeachers}
          icon={<Users className="h-5 w-5 text-blue-600" />}
          href="/admin/users"
        />
        <StatCard
          title="إجمالي الصفحات المحفوظة"
          value={totalPages}
          icon={<BookOpen className="h-5 w-5 text-amber-600" />}
          href="/students"
        />
      </div>

      {/* Attendance trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">نسبة الحضور — آخر 30 يوماً</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceChart data={attendanceTrend} />
        </CardContent>
      </Card>

      {/* Per-class progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">تقدم الحلقات</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-right px-4 py-3 font-medium">الحلقة</th>
                  <th className="text-right px-4 py-3 font-medium">المعلم</th>
                  <th className="text-center px-3 py-3 font-medium">الطلاب</th>
                  <th className="text-center px-3 py-3 font-medium whitespace-nowrap">متوسط الصفحات</th>
                  <th className="text-center px-3 py-3 font-medium whitespace-nowrap">نسبة الحضور</th>
                  <th className="text-center px-3 py-3 font-medium whitespace-nowrap">أيام مهملة</th>
                  <th className="text-center px-3 py-3 font-medium">تقرير</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {classProgress.map((cls) => (
                  <tr key={cls.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/classes/${cls.id}`}
                        className="font-medium hover:underline"
                      >
                        {cls.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{cls.teacherName}</td>
                    <td className="px-3 py-3 text-center">{cls.rosterCount}</td>
                    <td className="px-3 py-3 text-center">{cls.avgPages} ص</td>
                    <td className="px-3 py-3 text-center">
                      {cls.attRate != null ? (
                        <span
                          className={
                            cls.attRate < 70
                              ? "text-red-600 font-medium"
                              : "text-green-700"
                          }
                        >
                          {cls.attRate}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {cls.missedDays > 0 ? (
                        <Badge variant="destructive" className="text-xs">
                          {cls.missedDays}
                        </Badge>
                      ) : (
                        <span className="text-green-600 text-xs">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Link
                        href={`/classes/${cls.id}/report`}
                        className="text-xs text-green-700 hover:underline"
                      >
                        عرض
                      </Link>
                    </td>
                  </tr>
                ))}
                {classProgress.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      لا توجد حلقات نشطة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* At-risk students */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-base">
              الطلاب بحاجة للمتابعة
              {atRiskAll.length > 0 && (
                <Badge variant="destructive" className="mr-2 text-xs">
                  {atRiskAll.length}
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {atRiskAll.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              جميع الطلاب على المسار 👍
            </p>
          ) : (
            <div className="divide-y">
              {atRiskAll.map((s) => (
                <Link
                  key={s.id}
                  href={`/students/${s.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-muted/40 px-2 rounded-lg -mx-2 transition-colors"
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={s.photoUrl ?? undefined} alt={s.fullName} />
                    <AvatarFallback className="bg-orange-100 text-orange-800 text-xs font-semibold">
                      {s.fullName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.className} · {s.teacherName}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {s.noNewHifz && (
                      <Badge
                        variant="outline"
                        className="text-xs text-orange-700 border-orange-300"
                      >
                        لا حفظ جديد — 7 أيام
                      </Badge>
                    )}
                    {s.lowAttendance && (
                      <Badge
                        variant="outline"
                        className="text-xs text-red-700 border-red-300"
                      >
                        حضور منخفض
                      </Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Teacher activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">نشاط المعلمين</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-right px-4 py-3 font-medium">المعلم</th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">
                  جلسات هذا الأسبوع
                </th>
                <th className="text-center px-3 py-3 font-medium whitespace-nowrap">
                  آخر نشاط
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {teachers.map((t) => {
                const sessions = sessionsByTeacher.get(t.id) ?? 0
                const lastAct = lastActivityMap.get(t.id) ?? null
                return (
                  <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        href={`/teachers/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.fullName}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {sessions > 0 ? (
                        <Badge className="bg-green-100 text-green-800 text-xs">
                          {sessions}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-muted-foreground text-xs">
                      {lastAct ?? "—"}
                    </td>
                  </tr>
                )
              })}
              {teachers.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    لا يوجد معلمون
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Shared StatCard ──────────────────────────────────────────────────────────

function StatCard({
  title, value, icon, href,
}: {
  title: string; value: number; icon: React.ReactNode; href: string
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center justify-between mb-2">
            {icon}
          </div>
          <p className="text-2xl font-bold">{value.toLocaleString("ar-SA")}</p>
          <p className="text-sm text-muted-foreground">{title}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

// ─── Page Entry ───────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth()
  const role = session!.user.role!
  const userId = session!.user.id!
  const userName = session!.user.name!

  if (role === "PRINCIPAL") {
    return <PrincipalDashboard userName={userName} />
  }
  return <TeacherDashboard userId={userId} userName={userName} />
}

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ReportCardsClient } from "./report-cards-client"

export default async function ReportCardsPage() {
  const session = await auth()
  const role = session!.user.role!
  const userId = session!.user.id!

  const classes =
    role === "PRINCIPAL"
      ? await prisma.class.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, teacher: { select: { fullName: true } } },
        })
      : await prisma.class.findMany({
          where: { teacherId: userId, status: "ACTIVE" },
          select: { id: true, name: true, teacher: { select: { fullName: true } } },
        })

  const classIds = classes.map((c) => c.id)
  const classMap = new Map(
    classes.map((c) => [c.id, { name: c.name, teacherName: c.teacher.fullName }]),
  )

  const rawStudents = await prisma.student.findMany({
    where: {
      classId: { in: classIds },
      status: { in: ["ACTIVE", "GUEST"] },
    },
    select: {
      id: true,
      fullName: true,
      guardianPhone: true,
      guardianName: true,
      classId: true,
      currentTotalPagesMemorized: true,
      previousHifzPages: true,
    },
    orderBy: { fullName: "asc" },
  })

  const studentIds = rawStudents.map((s) => s.id)

  // Fetch all NEW recitation entries to derive surah range per student
  const allNewEntries = await prisma.recitationEntry.findMany({
    where: {
      type: "NEW",
      hifzSession: { studentId: { in: studentIds } },
    },
    select: {
      fromPage: true,
      toPage: true,
      fromSurah: true,
      fromAyah: true,
      toSurah: true,
      toAyah: true,
      hifzSession: { select: { studentId: true } },
    },
  })

  type SurahRange = {
    minFromPage: number
    fromSurah: number | null
    fromAyah: number | null
    maxToPage: number
    toSurah: number | null
    toAyah: number | null
  }

  const rangeMap = new Map<string, SurahRange>()
  for (const e of allNewEntries) {
    const sid = e.hifzSession.studentId
    const curr = rangeMap.get(sid)
    if (!curr) {
      rangeMap.set(sid, {
        minFromPage: e.fromPage,
        fromSurah: e.fromSurah,
        fromAyah: e.fromAyah,
        maxToPage: e.toPage,
        toSurah: e.toSurah,
        toAyah: e.toAyah,
      })
    } else {
      if (e.fromPage < curr.minFromPage) {
        curr.minFromPage = e.fromPage
        curr.fromSurah = e.fromSurah
        curr.fromAyah = e.fromAyah
      }
      if (e.toPage > curr.maxToPage) {
        curr.maxToPage = e.toPage
        curr.toSurah = e.toSurah
        curr.toAyah = e.toAyah
      }
    }
  }

  // Collect surah numbers needed and fetch their Arabic names
  const surahNums = new Set<number>()
  for (const r of rangeMap.values()) {
    if (r.fromSurah) surahNums.add(r.fromSurah)
    if (r.toSurah) surahNums.add(r.toSurah)
  }

  const surahRecords =
    surahNums.size > 0
      ? await prisma.surah.findMany({ where: { number: { in: [...surahNums] } } })
      : []
  const surahNameMap = new Map(surahRecords.map((s) => [s.number, s.nameAr]))

  const students = rawStudents.map((s) => {
    const prev = s.previousHifzPages ?? 0
    const total = s.currentTotalPagesMemorized
    const range = rangeMap.get(s.id)
    return {
      id: s.id,
      fullName: s.fullName,
      guardianPhone: s.guardianPhone,
      guardianName: s.guardianName,
      classId: s.classId,
      className: s.classId ? (classMap.get(s.classId)?.name ?? null) : null,
      teacherName: s.classId ? (classMap.get(s.classId)?.teacherName ?? null) : null,
      totalPages: total,
      pageFrom: total > 0 ? prev + 1 : null,
      pageTo: total > 0 ? prev + total : null,
      fromSurahName: range?.fromSurah ? (surahNameMap.get(range.fromSurah) ?? null) : null,
      fromAyah: range?.fromAyah ?? null,
      toSurahName: range?.toSurah ? (surahNameMap.get(range.toSurah) ?? null) : null,
      toAyah: range?.toAyah ?? null,
    }
  })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">كشف الدرجات</h1>
        <p className="text-sm text-muted-foreground">
          اختر الحلقة والطالب والفترة الزمنية لتوليد كشف المتابعة
        </p>
      </div>
      <ReportCardsClient students={students} classes={classes} />
    </div>
  )
}

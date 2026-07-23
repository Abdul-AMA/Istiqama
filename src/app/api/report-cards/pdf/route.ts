import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { ReportCardDocument } from "@/components/report-card-pdf"
import { formatDate } from "@/lib/date"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 })
  const role = session.user.role
  const userId = session.user.id!

  const { studentId, from, to, teacherNotes } = await req.json()
  if (!studentId || !from || !to) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 })
  }

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      fullName: true,
      photoUrl: true,
      currentTotalPagesMemorized: true,
      previousHifzPages: true,
      class: { select: { name: true, teacher: { select: { fullName: true, id: true } } } },
    },
  })
  if (!student) return NextResponse.json({ error: "الطالب غير موجود" }, { status: 404 })

  if (role === "TEACHER" && student.class?.teacher.id !== userId) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const fromDate = new Date(from)
  const toDate = new Date(to)

  const [attendanceRecords, hifzSessions, sardRecords, allNewEntries] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { studentId, date: { gte: fromDate, lte: toDate } },
      select: { status: true, date: true },
    }),
    prisma.hifzSession.findMany({
      where: { studentId, date: { gte: fromDate, lte: toDate } },
      select: {
        date: true,
        entries: { select: { type: true, fromPage: true, toPage: true, rating: true } },
      },
    }),
    prisma.sardRecord.findMany({
      where: { studentId },
      orderBy: { date: "desc" },
      take: 2,
      select: { type: true, date: true, fromJuz: true, toJuz: true, rating: true },
    }),
    // All NEW entries ever — to get overall surah range
    prisma.recitationEntry.findMany({
      where: {
        type: "NEW",
        hifzSession: { studentId },
      },
      select: {
        fromPage: true,
        toPage: true,
        fromSurah: true,
        fromAyah: true,
        toSurah: true,
        toAyah: true,
      },
    }),
  ])

  // Attendance summary
  const attCounts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
  for (const r of attendanceRecords) {
    attCounts[r.status]++
  }
  const totalSessions = attendanceRecords.length
  const presentCount = attCounts.PRESENT + attCounts.LATE
  const attPct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0

  // Pages added in range + average rating
  let newPagesInRange = 0
  const allRatings: number[] = []
  for (const sess of hifzSessions) {
    for (const e of sess.entries) {
      if (e.type === "NEW") {
        newPagesInRange += e.toPage - e.fromPage + 1
      }
      allRatings.push(e.rating)
    }
  }
  const avgRating =
    allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0

  // Overall surah range from all NEW entries
  let minFromPage = Infinity
  let maxToPage = -Infinity
  let fromSurah: number | null = null
  let fromAyah: number | null = null
  let toSurah: number | null = null
  let toAyah: number | null = null

  for (const e of allNewEntries) {
    if (e.fromPage < minFromPage) {
      minFromPage = e.fromPage
      fromSurah = e.fromSurah
      fromAyah = e.fromAyah
    }
    if (e.toPage > maxToPage) {
      maxToPage = e.toPage
      toSurah = e.toSurah
      toAyah = e.toAyah
    }
  }

  // Fetch surah names
  const surahNums = [fromSurah, toSurah].filter((n): n is number => n !== null)
  const surahRecords =
    surahNums.length > 0
      ? await prisma.surah.findMany({ where: { number: { in: surahNums } } })
      : []
  const surahNameMap = new Map(surahRecords.map((s) => [s.number, s.nameAr]))

  const lastSard = sardRecords.find((s) => s.type === "INDIVIDUAL")
  const lastGroupSard = sardRecords.find((s) => s.type === "GROUP")

  const RATING_AR = ["", "يحتاج إعادة", "جيد", "جيد جداً", "ممتاز"]

  const data = {
    studentName: student.fullName,
    photoUrl: student.photoUrl,
    className: student.class?.name ?? "",
    teacherName: student.class?.teacher.fullName ?? "",
    from: formatDate(from),
    to: formatDate(to),
    totalPagesMemorized: student.currentTotalPagesMemorized,
    fromSurahName: fromSurah ? (surahNameMap.get(fromSurah) ?? null) : null,
    fromAyah,
    toSurahName: toSurah ? (surahNameMap.get(toSurah) ?? null) : null,
    toAyah,
    newPagesInRange,
    presentCount: attCounts.PRESENT,
    absentCount: attCounts.ABSENT,
    lateCount: attCounts.LATE,
    excusedCount: attCounts.EXCUSED,
    totalSessions,
    attendancePct: attPct,
    attendanceDays: presentCount,
    avgRatingLabel: avgRating > 0 ? (RATING_AR[Math.round(avgRating)] ?? "") : "—",
    sessionsCount: hifzSessions.length,
    lastSardFardi: lastSard
      ? {
          date: formatDate(lastSard.date),
          juz:
            lastSard.fromJuz === lastSard.toJuz
              ? `جزء ${lastSard.fromJuz}`
              : `جزء ${lastSard.fromJuz}–${lastSard.toJuz}`,
          rating: RATING_AR[lastSard.rating] ?? "",
        }
      : null,
    lastSardJamai: lastGroupSard
      ? {
          date: formatDate(lastGroupSard.date),
          juz:
            lastGroupSard.fromJuz === lastGroupSard.toJuz
              ? `جزء ${lastGroupSard.fromJuz}`
              : `جزء ${lastGroupSard.fromJuz}–${lastGroupSard.toJuz}`,
          rating: RATING_AR[lastGroupSard.rating] ?? "",
        }
      : null,
    teacherNotes: teacherNotes ?? "",
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(createElement(ReportCardDocument, { data }) as any)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-${encodeURIComponent(student.fullName)}.pdf"`,
      },
    })
  } catch (err) {
    console.error("PDF render error:", err)
    return NextResponse.json({ error: "فشل إنشاء PDF" }, { status: 500 })
  }
}

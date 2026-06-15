"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

const logSchema = z.object({
  studentId:  z.string().optional(),
  classId:    z.string().optional(),
  categoryId: z.string().optional(),
  channel:    z.enum(["INDIVIDUAL", "GROUP"]),
  mode:       z.enum(["TEMPLATE", "AI"]),
  body:       z.string().min(1),
})

export async function saveMessageLog(input: z.infer<typeof logSchema>) {
  const session = await auth()
  if (!session?.user) throw new Error("غير مصرح")
  const data = logSchema.parse(input)
  await prisma.messageLog.create({
    data: {
      ...data,
      createdByUserId: session.user.id!,
    },
  })
}

export async function getAttendanceDays(studentId: string, from: string, to: string): Promise<number> {
  const session = await auth()
  if (!session?.user) return 0

  const count = await prisma.attendanceRecord.count({
    where: {
      studentId,
      date: { gte: new Date(from), lte: new Date(to) },
      status: { in: ["PRESENT", "LATE"] },
    },
  })
  return count
}

export async function getGroupReportData(classId: string, date: string) {
  const session = await auth()
  if (!session?.user) throw new Error("غير مصرح")
  const role = session.user.role
  const userId = session.user.id!

  const cls = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, teacherId: true, teacher: { select: { fullName: true } } },
  })
  if (!cls) throw new Error("الحلقة غير موجودة")
  if (role === "TEACHER" && cls.teacherId !== userId) throw new Error("غير مصرح")

  const dateObj = new Date(date)

  const [students, allSurahs] = await Promise.all([
    prisma.student.findMany({
      where: { classId, status: { in: ["ACTIVE", "GUEST"] } },
      select: {
        id: true,
        fullName: true,
        currentTotalPagesMemorized: true,
        attendanceRecords: {
          where: { date: dateObj },
          select: { status: true },
        },
        hifzSessions: {
          where: { date: dateObj },
          select: {
            generalNotes: true,
            entries: {
              select: {
                type: true,
                fromSurah: true,
                fromAyah: true,
                toAyah: true,
                surahCompleted: true,
                pagesCount: true,
                rating: true,
                mistakeCount: true,
                notes: true,
              },
            },
          },
        },
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.surah.findMany({ select: { number: true, nameAr: true } }),
  ])

  const surahMap = new Map(allSurahs.map((s) => [s.number, s.nameAr]))

  const RATING_AR = ["", "يحتاج إعادة", "جيد", "جيد جداً", "ممتاز"]
  const ATT_AR: Record<string, string> = {
    PRESENT: "حاضر",
    ABSENT: "غائب",
    LATE: "متأخر",
    EXCUSED: "معذور",
  }

  function fmtEntry(e: { fromSurah: number | null; fromAyah: number | null; toAyah: number | null; surahCompleted: boolean; pagesCount: number | null; rating: number; mistakeCount: number }) {
    const name = e.fromSurah ? (surahMap.get(e.fromSurah) ?? `سورة ${e.fromSurah}`) : "؟"
    const ayahs = e.surahCompleted ? "(كاملة)" : `${e.fromAyah}–${e.toAyah}`
    const pages = e.pagesCount ? ` ${e.pagesCount}ص` : ""
    const rating = RATING_AR[e.rating] ?? ""
    const mistakes = e.mistakeCount > 0 ? ` أخطاء:${e.mistakeCount}` : ""
    return `${name} ${ayahs}${pages} ⭐${rating}${mistakes}`
  }

  const lines: string[] = [
    `📚 تقرير حلقة ${cls.name}`,
    `📅 ${date}`,
    `👨‍🏫 المعلم: ${cls.teacher.fullName}`,
    `─────────────────`,
  ]

  const absentStudents: string[] = []

  for (const s of students) {
    const att = s.attendanceRecords[0]?.status ?? "PRESENT"
    const session = s.hifzSessions[0]

    if (att === "ABSENT" || att === "EXCUSED") {
      absentStudents.push(`${s.fullName} (${ATT_AR[att]})`)
      continue
    }

    const attLabel = ATT_AR[att] ?? "حاضر"
    const newEntries = session?.entries.filter((e) => e.type === "NEW") ?? []
    const revEntries = session?.entries.filter((e) => e.type === "RECENT_REVISION") ?? []

    lines.push(`👤 ${s.fullName} — ${attLabel}`)

    if (newEntries.length > 0) {
      lines.push(`   📖 حفظ: ${newEntries.map(fmtEntry).join(" | ")}`)
    } else {
      lines.push(`   📖 لا حفظ جديد`)
    }

    if (revEntries.length > 0) {
      lines.push(`   🔄 مراجعة: ${revEntries.map((e) => {
        const name = e.fromSurah ? (surahMap.get(e.fromSurah) ?? `سورة ${e.fromSurah}`) : "؟"
        const ayahs = e.surahCompleted ? "(كاملة)" : `${e.fromAyah}–${e.toAyah}`
        return `${name} ${ayahs}`
      }).join(" | ")}`)
    }

    if (session?.generalNotes) {
      lines.push(`   💬 ${session.generalNotes}`)
    }
  }

  if (absentStudents.length > 0) {
    lines.push(`─────────────────`)
    lines.push(`❌ الغياب: ${absentStudents.join("، ")}`)
  }

  lines.push(`─────────────────`)
  lines.push(`بارك الله في جميع الطلاب 🤲`)

  return { text: lines.join("\n"), className: cls.name, classId: cls.id }
}

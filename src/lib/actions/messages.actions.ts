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

  const students = await prisma.student.findMany({
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
          entries: {
            select: { type: true, fromPage: true, toPage: true, rating: true, mistakeCount: true },
          },
        },
      },
    },
    orderBy: { fullName: "asc" },
  })

  const RATING_AR = ["", "يحتاج إعادة", "جيد", "جيد جداً", "ممتاز"]
  const ATT_AR: Record<string, string> = {
    PRESENT: "حاضر",
    ABSENT: "غائب",
    LATE: "متأخر",
    EXCUSED: "معذور",
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
    const newEntry = session?.entries.find((e) => e.type === "NEW")

    if (att === "ABSENT" || att === "EXCUSED") {
      absentStudents.push(`${s.fullName} (${ATT_AR[att]})`)
      continue
    }

    const attLabel = ATT_AR[att] ?? "حاضر"
    const sabaq = newEntry
      ? `ص${newEntry.fromPage}–${newEntry.toPage} | ${RATING_AR[newEntry.rating] ?? ""}`
      : "لا حفظ جديد"

    lines.push(`👤 ${s.fullName}`)
    lines.push(`   الحضور: ${attLabel} | الحفظ: ${sabaq}`)
  }

  if (absentStudents.length > 0) {
    lines.push(`─────────────────`)
    lines.push(`❌ الغياب: ${absentStudents.join("، ")}`)
  }

  lines.push(`─────────────────`)
  lines.push(`بارك الله في جميع الطلاب 🤲`)

  return { text: lines.join("\n"), className: cls.name, classId: cls.id }
}

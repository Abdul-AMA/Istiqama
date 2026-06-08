import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const recitationSchema = z.object({
  type: z.enum(["NEW", "RECENT_REVISION", "OLD_REVISION"]),
  fromPage: z.coerce.number().int().min(1).max(604),
  toPage: z.coerce.number().int().min(1).max(604),
  rating: z.coerce.number().int().min(1).max(4),
  mistakeCount: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
})

const studentEntrySchema = z.object({
  studentId: z.string(),
  attendance: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).default("PRESENT"),
  attendanceNotes: z.string().optional(),
  generalNotes: z.string().optional(),
  recitations: z.array(recitationSchema).max(3),
})

const payloadSchema = z.object({
  classId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(studentEntrySchema),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 })

  const body = await req.json()
  const parsed = payloadSchema.safeParse(body.payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { classId, date: dateStr, entries } = parsed.data
  const userId = session.user.id!
  const role = session.user.role!

  if (role !== "PRINCIPAL") {
    const cls = await prisma.class.findFirst({ where: { id: classId, teacherId: userId } })
    if (!cls) return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const date = new Date(dateStr)

  try {
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const { studentId, attendance, attendanceNotes, generalNotes, recitations } = entry

        await tx.attendanceRecord.upsert({
          where: { studentId_date: { studentId, date } },
          create: {
            studentId,
            classId,
            date,
            status: attendance,
            notes: attendanceNotes ?? null,
            recordedByUserId: userId,
          },
          update: {
            status: attendance,
            notes: attendanceNotes ?? null,
            recordedByUserId: userId,
          },
        })

        const isPresent = attendance === "PRESENT" || attendance === "LATE"

        if (!isPresent || recitations.length === 0) {
          const existing = await tx.hifzSession.findUnique({
            where: { studentId_date: { studentId, date } },
          })
          if (existing) await tx.hifzSession.delete({ where: { id: existing.id } })
          continue
        }

        const hifzSession = await tx.hifzSession.upsert({
          where: { studentId_date: { studentId, date } },
          create: {
            studentId,
            classId,
            date,
            generalNotes: generalNotes ?? null,
            recordedByUserId: userId,
          },
          update: { generalNotes: generalNotes ?? null, recordedByUserId: userId },
        })

        await tx.recitationEntry.deleteMany({ where: { hifzSessionId: hifzSession.id } })

        for (const rec of recitations) {
          await tx.recitationEntry.create({
            data: {
              hifzSessionId: hifzSession.id,
              type: rec.type,
              fromPage: rec.fromPage,
              toPage: rec.toPage,
              rating: rec.rating,
              mistakeCount: rec.mistakeCount,
              notes: rec.notes ?? null,
            },
          })
        }

        const newEntry = recitations.find((r) => r.type === "NEW")
        if (newEntry) {
          const juz = Math.ceil(newEntry.toPage / 20)
          const sabaqRef = `ص ${newEntry.fromPage}–${newEntry.toPage}`
          const allNewEntries = await tx.recitationEntry.findMany({
            where: { hifzSession: { studentId }, type: "NEW" },
          })
          const student = await tx.student.findUnique({
            where: { id: studentId },
            select: { previousHifzPages: true },
          })
          const basePrev = student?.previousHifzPages ?? 0
          const uniquePages = new Set<number>()
          allNewEntries.forEach((e) => {
            for (let p = e.fromPage; p <= e.toPage; p++) uniquePages.add(p)
          })
          const total = basePrev + uniquePages.size
          await tx.student.update({
            where: { id: studentId },
            data: {
              currentTotalPagesMemorized: total,
              currentJuz: juz,
              lastSabaqReference: sabaqRef,
            },
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("sync daily-session error:", err)
    return NextResponse.json({ error: "حدث خطأ أثناء الحفظ" }, { status: 500 })
  }
}

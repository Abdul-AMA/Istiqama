import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const recitationSchema = z.object({
  type: z.enum(["NEW", "RECENT_REVISION"]),
  surahNumber: z.coerce.number().int().min(1).max(114),
  fromAyah: z.coerce.number().int().min(1),
  toAyah: z.coerce.number().int().min(1),
  surahCompleted: z.boolean().default(false),
  pagesCount: z.coerce.number().min(0.5).optional(),
  rating: z.coerce.number().int().min(1).max(4),
  mistakeCount: z.coerce.number().int().min(0).default(0),
  notes: z.string().optional(),
})

const studentEntrySchema = z.object({
  studentId: z.string(),
  attendance: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]).default("PRESENT"),
  attendanceNotes: z.string().optional(),
  generalNotes: z.string().optional(),
  recitations: z.array(recitationSchema),
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

  // Pre-fetch surahs
  const surahNumbers = [...new Set(entries.flatMap((e) => e.recitations.map((r) => r.surahNumber)))]
  const surahMap = new Map(
    (await prisma.surah.findMany({
      where: { number: { in: surahNumbers } },
      select: { number: true, nameAr: true, ayahCount: true, startPage: true },
    })).map((s) => [s.number, s])
  )
  const allSurahs = await prisma.surah.findMany({
    select: { number: true, startPage: true },
    orderBy: { number: "asc" },
  })
  const surahEndPage = new Map<number, number>()
  for (let i = 0; i < allSurahs.length; i++) {
    surahEndPage.set(allSurahs[i].number, i + 1 < allSurahs.length ? allSurahs[i + 1].startPage - 1 : 604)
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const { studentId, attendance, attendanceNotes, generalNotes, recitations } = entry

        await tx.attendanceRecord.upsert({
          where: { studentId_date: { studentId, date } },
          create: { studentId, classId, date, status: attendance, notes: attendanceNotes ?? null, recordedByUserId: userId },
          update: { status: attendance, notes: attendanceNotes ?? null, recordedByUserId: userId },
        })

        const isPresent = attendance === "PRESENT" || attendance === "LATE"

        if (!isPresent || recitations.length === 0) {
          const existing = await tx.hifzSession.findUnique({ where: { studentId_date: { studentId, date } } })
          if (existing) await tx.hifzSession.delete({ where: { id: existing.id } })
          continue
        }

        const hifzSession = await tx.hifzSession.upsert({
          where: { studentId_date: { studentId, date } },
          create: { studentId, classId, date, generalNotes: generalNotes ?? null, recordedByUserId: userId },
          update: { generalNotes: generalNotes ?? null, recordedByUserId: userId },
        })

        await tx.recitationEntry.deleteMany({ where: { hifzSessionId: hifzSession.id } })

        for (const rec of recitations) {
          const surah = surahMap.get(rec.surahNumber)
          const fromPage = surah?.startPage ?? 1
          const toPage = rec.surahCompleted ? (surahEndPage.get(rec.surahNumber) ?? fromPage) : fromPage

          await tx.recitationEntry.create({
            data: {
              hifzSessionId: hifzSession.id,
              type: rec.type,
              fromPage,
              toPage,
              fromSurah: rec.surahNumber,
              fromAyah: rec.fromAyah,
              toSurah: rec.surahNumber,
              toAyah: rec.toAyah,
              surahCompleted: rec.surahCompleted,
              pagesCount: rec.pagesCount ?? null,
              rating: rec.rating,
              mistakeCount: rec.mistakeCount,
              notes: rec.notes ?? null,
            },
          })
        }

        const newEntries = recitations.filter((r) => r.type === "NEW")
        if (newEntries.length > 0) {
          const lastNew = newEntries[newEntries.length - 1]
          const lastSurah = surahMap.get(lastNew.surahNumber)
          const surahName = lastSurah?.nameAr ?? ""
          const sabaqRef = lastNew.surahCompleted
            ? `${surahName} (كاملة)`
            : `${surahName}: ${lastNew.fromAyah}–${lastNew.toAyah}`

          const allNewEntries = await tx.recitationEntry.findMany({
            where: { hifzSession: { studentId }, type: "NEW" },
            select: { fromPage: true, toPage: true, pagesCount: true },
          })
          const student = await tx.student.findUnique({
            where: { id: studentId },
            select: { previousHifzPages: true },
          })
          const basePrev = student?.previousHifzPages ?? 0
          let manualPages = 0
          const legacyPageSet = new Set<number>()
          for (const e of allNewEntries) {
            if (e.pagesCount !== null) {
              manualPages += e.pagesCount
            } else {
              for (let p = e.fromPage; p <= e.toPage; p++) legacyPageSet.add(p)
            }
          }
          const total = Math.round(basePrev + manualPages + legacyPageSet.size)

          await tx.student.update({
            where: { id: studentId },
            data: {
              currentTotalPagesMemorized: total,
              currentJuz: Math.ceil((lastSurah?.startPage ?? 1) / 20),
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

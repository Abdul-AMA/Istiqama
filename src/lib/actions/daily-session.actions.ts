"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

// ─── Auth helper ─────────────────────────────────────────────────────────────

async function getSessionOrThrow() {
  const session = await auth()
  if (!session?.user) throw new Error("غير مصرح")
  return session
}

async function assertClassAccess(userId: string, role: string, classId: string) {
  if (role === "PRINCIPAL") return
  const cls = await prisma.class.findFirst({ where: { id: classId, teacherId: userId } })
  if (!cls) throw new Error("غير مصرح — هذه الحلقة ليست لك")
}

// ─── Get teacher's classes ────────────────────────────────────────────────────

export async function getMyClasses() {
  const session = await getSessionOrThrow()
  const role = session.user.role!
  const userId = session.user.id!

  return prisma.class.findMany({
    where: role === "PRINCIPAL" ? { status: "ACTIVE" } : { teacherId: userId, status: "ACTIVE" },
    select: { id: true, name: true, teacher: { select: { fullName: true } } },
    orderBy: { name: "asc" },
  })
}

// ─── Get roster for a class (for offline cache warming) ──────────────────────

export async function getClassRoster(classId: string) {
  const session = await getSessionOrThrow()
  await assertClassAccess(session.user.id!, session.user.role!, classId)

  return prisma.student.findMany({
    where: { classId, status: { in: ["ACTIVE", "GUEST"] } },
    select: {
      id: true,
      fullName: true,
      photoUrl: true,
      status: true,
      currentTotalPagesMemorized: true,
      lastSabaqReference: true,
    },
    orderBy: { fullName: "asc" },
  })
}

// ─── Get all surahs (for surah selector) ─────────────────────────────────────

export async function getAllSurahs() {
  return prisma.surah.findMany({
    select: { number: true, nameAr: true, ayahCount: true, startPage: true },
    orderBy: { number: "asc" },
  })
}

// ─── Load existing daily session data ────────────────────────────────────────

export async function loadDailySession(classId: string, dateStr: string) {
  const session = await getSessionOrThrow()
  await assertClassAccess(session.user.id!, session.user.role!, classId)

  const date = new Date(dateStr)

  const [students, attendanceRecords, hifzSessions] = await Promise.all([
    prisma.student.findMany({
      where: { classId, status: { in: ["ACTIVE", "GUEST"] } },
      select: {
        id: true,
        fullName: true,
        photoUrl: true,
        status: true,
        currentTotalPagesMemorized: true,
        lastSabaqReference: true,
      },
      orderBy: { fullName: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { classId, date },
      select: { studentId: true, status: true, notes: true },
    }),
    prisma.hifzSession.findMany({
      where: { classId, date },
      include: {
        entries: {
          select: {
            id: true,
            type: true,
            fromPage: true,
            toPage: true,
            fromSurah: true,
            fromAyah: true,
            toSurah: true,
            toAyah: true,
            surahCompleted: true,
            pagesCount: true,
            rating: true,
            mistakeCount: true,
            notes: true,
          },
        },
      },
    }),
  ])

  const attendanceMap = Object.fromEntries(attendanceRecords.map((r) => [r.studentId, r]))
  const hifzMap = Object.fromEntries(hifzSessions.map((s) => [s.studentId, s]))

  return students.map((s) => ({
    student: s,
    attendance: attendanceMap[s.id] ?? null,
    hifzSession: hifzMap[s.id] ?? null,
  }))
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

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

const saveSessionSchema = z.object({
  classId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  entries: z.array(studentEntrySchema),
})

export type SaveSessionInput = z.infer<typeof saveSessionSchema>
export type SaveSessionResult = { success: true } | { error: string }

// ─── Save (create/update) a full daily session ────────────────────────────────

export async function saveDailySession(input: SaveSessionInput): Promise<SaveSessionResult> {
  const session = await getSessionOrThrow()
  const userId = session.user.id!
  const role = session.user.role!

  const parsed = saveSessionSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { classId, date: dateStr, entries } = parsed.data

  try {
    await assertClassAccess(userId, role, classId)
  } catch {
    return { error: "غير مصرح" }
  }

  const date = new Date(dateStr)

  // Pre-fetch all surahs needed across all recitations
  const surahNumbers = [...new Set(entries.flatMap((e) => e.recitations.map((r) => r.surahNumber)))]
  const surahMap = new Map(
    (await prisma.surah.findMany({
      where: { number: { in: surahNumbers } },
      select: { number: true, nameAr: true, ayahCount: true, startPage: true },
    })).map((s) => [s.number, s])
  )

  // Build ordered surah list for end-page calculation
  const allSurahs = await prisma.surah.findMany({
    select: { number: true, startPage: true },
    orderBy: { number: "asc" },
  })
  const surahEndPage = new Map<number, number>()
  for (let i = 0; i < allSurahs.length; i++) {
    const endPage = i + 1 < allSurahs.length ? allSurahs[i + 1].startPage - 1 : 604
    surahEndPage.set(allSurahs[i].number, endPage)
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

        // Update student snapshot from NEW entries
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
          const lastJuz = Math.ceil((surahMap.get(lastNew.surahNumber)?.startPage ?? 1) / 20)

          await tx.student.update({
            where: { id: studentId },
            data: {
              currentTotalPagesMemorized: total,
              currentJuz: lastJuz,
              lastSabaqReference: sabaqRef,
            },
          })
        }
      }
    })
  } catch (err) {
    console.error("saveDailySession error:", err)
    return { error: "حدث خطأ أثناء حفظ الجلسة — يرجى المحاولة مرة أخرى" }
  }

  revalidatePath("/daily")
  revalidatePath(`/classes/${classId}`)
  return { success: true }
}

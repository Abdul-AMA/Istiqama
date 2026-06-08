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
      include: { entries: true },
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

// ─── Surah range lookup ───────────────────────────────────────────────────────

export async function getSurahsForRange(fromPage: number, toPage: number) {
  if (!fromPage || !toPage || fromPage > toPage) return []
  const surahs = await prisma.surah.findMany({
    where: { startPage: { gte: fromPage, lte: toPage } },
    orderBy: { number: "asc" },
    select: { number: true, nameAr: true, startPage: true },
  })
  return surahs
}

// ─── Zod schemas ──────────────────────────────────────────────────────────────

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

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const { studentId, attendance, attendanceNotes, generalNotes, recitations } = entry

      // Attendance — upsert
      await tx.attendanceRecord.upsert({
        where: { studentId_date: { studentId, date } },
        create: { studentId, classId, date, status: attendance, notes: attendanceNotes ?? null, recordedByUserId: userId },
        update: { status: attendance, notes: attendanceNotes ?? null, recordedByUserId: userId },
      })

      const isPresent = attendance === "PRESENT" || attendance === "LATE"

      if (!isPresent || recitations.length === 0) {
        // Delete any existing hifz session if student is now absent/excused with no recitations
        const existing = await tx.hifzSession.findUnique({ where: { studentId_date: { studentId, date } } })
        if (existing) {
          await tx.hifzSession.delete({ where: { id: existing.id } })
        }
        continue
      }

      // HifzSession — upsert
      const hifzSession = await tx.hifzSession.upsert({
        where: { studentId_date: { studentId, date } },
        create: { studentId, classId, date, generalNotes: generalNotes ?? null, recordedByUserId: userId },
        update: { generalNotes: generalNotes ?? null, recordedByUserId: userId },
      })

      // RecitationEntries — delete all then recreate (clean upsert by type)
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

      // Update student snapshot if there's a NEW entry
      const newEntry = recitations.find((r) => r.type === "NEW")
      if (newEntry) {
        const juz = Math.ceil(newEntry.toPage / 20)
        const sabaqRef = `ص ${newEntry.fromPage}–${newEntry.toPage}`
        const allNewEntries = await tx.recitationEntry.findMany({
          where: { hifzSession: { studentId }, type: "NEW" },
          orderBy: { hifzSession: { date: "desc" } },
        })
        // Sum pages from all NEW entries (rough total)
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

  revalidatePath("/daily")
  revalidatePath(`/classes/${classId}`)
  return { success: true }
}

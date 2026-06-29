"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { saveDailySessionCore } from "@/lib/daily-session/save"

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

  try {
    await saveDailySessionCore({ classId, date: new Date(dateStr), entries, userId })
  } catch (err) {
    console.error("saveDailySession error:", err)
    return { error: "حدث خطأ أثناء حفظ الجلسة — يرجى المحاولة مرة أخرى" }
  }

  revalidatePath("/daily")
  revalidatePath(`/classes/${classId}`)
  return { success: true }
}

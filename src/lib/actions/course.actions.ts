"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { saveCourseScoresCore, type CourseScoreEntry } from "@/lib/courses/save"

// ─── Auth helpers ──────────────────────────────────────────────────────────

async function requirePrincipal() {
  const session = await auth()
  if (!session?.user) throw new Error("غير مصرح")
  if (session.user.role !== "PRINCIPAL") throw new Error("للمدير فقط")
  return session.user
}

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

// ─── Admin: course CRUD ────────────────────────────────────────────────────

const courseSchema = z.object({
  name: z.string().min(1, "اسم الدورة مطلوب"),
  description: z.string().optional(),
})

export type CourseFormState = { error?: string; success?: boolean }

function extractBadgeNames(formData: FormData): string[] {
  const names = formData.getAll("badgeName").map((v) => String(v).trim()).filter(Boolean)
  return [...new Set(names)]
}

export async function createCourse(_prev: CourseFormState, formData: FormData): Promise<CourseFormState> {
  try {
    const user = await requirePrincipal()
    const data = courseSchema.parse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
    })
    const badgeNames = extractBadgeNames(formData)

    await prisma.course.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        createdByUserId: user.id!,
        badges: { create: badgeNames.map((name, i) => ({ name, sortOrder: i })) },
      },
    })
    revalidatePath("/admin/courses")
    revalidatePath("/courses")
    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "خطأ" }
  }
}

export async function updateCourse(
  id: string,
  _prev: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  try {
    await requirePrincipal()
    const data = courseSchema.parse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
    })
    const badgeNames = extractBadgeNames(formData)

    await prisma.$transaction(async (tx) => {
      await tx.course.update({
        where: { id },
        data: { name: data.name, description: data.description ?? null },
      })

      const existing = await tx.courseBadge.findMany({ where: { courseId: id } })
      const existingNames = new Set(existing.map((b) => b.name))
      const keepNames = new Set(badgeNames)

      const toRemove = existing.filter((b) => !keepNames.has(b.name))
      if (toRemove.length > 0) {
        await tx.courseBadge.deleteMany({ where: { id: { in: toRemove.map((b) => b.id) } } })
      }

      const toAdd = badgeNames.filter((n) => !existingNames.has(n))
      for (let i = 0; i < toAdd.length; i++) {
        await tx.courseBadge.create({ data: { courseId: id, name: toAdd[i], sortOrder: existing.length + i } })
      }
    })

    revalidatePath("/admin/courses")
    revalidatePath(`/admin/courses/${id}`)
    revalidatePath("/courses")
    revalidatePath(`/courses/${id}`)
    return { success: true }
  } catch (e: unknown) {
    return { error: e instanceof Error ? e.message : "خطأ" }
  }
}

export async function toggleCourseActive(id: string, isActive: boolean) {
  await requirePrincipal()
  await prisma.course.update({ where: { id }, data: { isActive } })
  revalidatePath("/admin/courses")
  revalidatePath("/courses")
}

// ─── Admin: per-course halaqa overview (for XLSX export) ──────────────────

export async function getCourseAdminOverview(courseId: string) {
  await requirePrincipal()

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      badges: { select: { id: true, name: true }, orderBy: { sortOrder: "asc" } },
    },
  })
  if (!course) throw new Error("الدورة غير موجودة")

  const classes = await prisma.class.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      teacher: { select: { fullName: true, kunya: true } },
      _count: { select: { students: { where: { status: { in: ["ACTIVE", "GUEST"] } } } } },
    },
    orderBy: { name: "asc" },
  })

  const scoreCounts = await prisma.courseScore.groupBy({
    by: ["classId"],
    where: { courseId },
    _count: { _all: true },
  })
  const countMap = new Map(scoreCounts.map((c) => [c.classId, c._count._all]))

  return {
    course,
    halaqas: classes.map((c) => ({
      id: c.id,
      name: c.name,
      teacherLabel: c.teacher.kunya || c.teacher.fullName,
      totalStudents: c._count.students,
      scoredCount: countMap.get(c.id) ?? 0,
    })),
  }
}

// ─── Teacher: list active courses ──────────────────────────────────────────

export async function getMyCourses() {
  await getSessionOrThrow()

  return prisma.course.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      badges: { select: { id: true, name: true } },
    },
  })
}

// ─── Teacher: course detail + own classes ──────────────────────────────────

export async function getCourseForTeacher(courseId: string) {
  const session = await getSessionOrThrow()
  const role = session.user.role!
  const userId = session.user.id!

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      description: true,
      badges: { select: { id: true, name: true }, orderBy: { sortOrder: "asc" } },
    },
  })
  if (!course) throw new Error("الدورة غير موجودة")

  const classes = await prisma.class.findMany({
    where: role === "PRINCIPAL" ? { status: "ACTIVE" } : { teacherId: userId, status: "ACTIVE" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })

  return { course, classes }
}

// ─── Teacher: load roster + existing scores for a course/class ────────────

export async function loadCourseRoster(courseId: string, classId: string) {
  const session = await getSessionOrThrow()
  await assertClassAccess(session.user.id!, session.user.role!, classId)

  const [students, scores] = await Promise.all([
    prisma.student.findMany({
      where: { classId, status: { in: ["ACTIVE", "GUEST"] } },
      select: { id: true, fullName: true, photoUrl: true, status: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.courseScore.findMany({
      where: { courseId, classId },
      select: {
        studentId: true,
        score: true,
        notes: true,
        badgeResults: { select: { badgeId: true }, where: { earned: true } },
      },
    }),
  ])

  const scoreMap = new Map(scores.map((s) => [s.studentId, s]))

  return students.map((s) => ({
    student: s,
    score: scoreMap.get(s.id) ?? null,
  }))
}

// ─── Teacher: save all scores for a course/class ───────────────────────────

const courseScoreEntrySchema = z.object({
  studentId: z.string(),
  score: z.coerce.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
  badgeIds: z.array(z.string()).default([]),
})

const saveCourseScoresSchema = z.object({
  courseId: z.string(),
  classId: z.string(),
  entries: z.array(courseScoreEntrySchema),
})

export type SaveCourseScoresInput = z.infer<typeof saveCourseScoresSchema>
export type SaveCourseScoresResult = { success: true } | { error: string }

export async function saveCourseScores(input: SaveCourseScoresInput): Promise<SaveCourseScoresResult> {
  const session = await getSessionOrThrow()
  const userId = session.user.id!
  const role = session.user.role!

  const parsed = saveCourseScoresSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors[0].message }

  const { courseId, classId, entries } = parsed.data

  try {
    await assertClassAccess(userId, role, classId)
  } catch {
    return { error: "غير مصرح" }
  }

  try {
    await saveCourseScoresCore({ courseId, classId, entries: entries as CourseScoreEntry[], userId })
  } catch (err) {
    console.error("saveCourseScores error:", err)
    return { error: "حدث خطأ أثناء حفظ الدرجات — يرجى المحاولة مرة أخرى" }
  }

  revalidatePath(`/courses/${courseId}`)
  revalidatePath(`/admin/courses/${courseId}`)
  return { success: true }
}

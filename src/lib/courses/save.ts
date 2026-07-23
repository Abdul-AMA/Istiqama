import { prisma } from "@/lib/prisma"

export type CourseScoreEntry = {
  studentId: string
  score?: number
  notes?: string
  badgeIds: string[]
}

// Accepts already-validated input. Auth and revalidatePath are the caller's
// responsibility. Throws on DB error so callers can handle it.
export async function saveCourseScoresCore(params: {
  courseId: string
  classId: string
  entries: CourseScoreEntry[]
  userId: string
}): Promise<void> {
  const { courseId, classId, entries, userId } = params

  await prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const courseScore = await tx.courseScore.upsert({
        where: { courseId_studentId: { courseId, studentId: entry.studentId } },
        create: {
          courseId,
          studentId: entry.studentId,
          classId,
          score: entry.score ?? null,
          notes: entry.notes ?? null,
          recordedByUserId: userId,
        },
        update: {
          classId,
          score: entry.score ?? null,
          notes: entry.notes ?? null,
          recordedByUserId: userId,
        },
      })

      await tx.courseBadgeResult.deleteMany({ where: { courseScoreId: courseScore.id } })
      if (entry.badgeIds.length > 0) {
        await tx.courseBadgeResult.createMany({
          data: entry.badgeIds.map((badgeId) => ({
            courseScoreId: courseScore.id,
            badgeId,
            earned: true,
          })),
        })
      }
    }
  })
}

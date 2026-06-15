import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { MessagesClient } from "./messages-client"

export default async function MessagesPage() {
  const session = await auth()
  const role = session!.user.role!
  const userId = session!.user.id!
  const userName = session!.user.name!

  const [categories, classes] = await Promise.all([
    prisma.messageCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, tone: true, template: true },
    }),
    role === "PRINCIPAL"
      ? prisma.class.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : prisma.class.findMany({
          where: { teacherId: userId, status: "ACTIVE" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
  ])

  // Load students scoped to role
  const classIds = classes.map((c) => c.id)

  const [rawStudents, allSurahs] = await Promise.all([
    prisma.student.findMany({
      where: {
        classId: { in: classIds },
        status: { in: ["ACTIVE", "GUEST"] },
      },
      select: {
        id: true,
        fullName: true,
        guardianPhone: true,
        guardianName: true,
        classId: true,
        currentTotalPagesMemorized: true,
        class: { select: { name: true, teacher: { select: { fullName: true } } } },
        attendanceRecords: {
          orderBy: { date: "desc" },
          take: 1,
          select: { status: true },
        },
        hifzSessions: {
          orderBy: { date: "desc" },
          take: 1,
          select: {
            date: true,
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

  const students = rawStudents.map((s) => {
    const sess = s.hifzSessions[0]
    const mapEntry = (e: typeof sess extends undefined ? never : NonNullable<typeof sess>["entries"][number]) => ({
      surahName: e.fromSurah ? (surahMap.get(e.fromSurah) ?? null) : null,
      fromAyah: e.fromAyah,
      toAyah: e.toAyah,
      surahCompleted: e.surahCompleted,
      pagesCount: e.pagesCount,
      rating: e.rating,
      mistakeCount: e.mistakeCount,
      notes: e.notes,
    })
    return {
      id: s.id,
      fullName: s.fullName,
      guardianPhone: s.guardianPhone,
      guardianName: s.guardianName,
      classId: s.classId,
      className: s.class?.name ?? null,
      teacherName: s.class?.teacher?.fullName ?? null,
      totalPages: s.currentTotalPagesMemorized,
      lastSession: sess
        ? {
            date: sess.date.toISOString().slice(0, 10),
            attendanceStatus: s.attendanceRecords[0]?.status ?? null,
            newEntries: sess.entries.filter((e) => e.type === "NEW").map(mapEntry),
            revEntries: sess.entries.filter((e) => e.type === "RECENT_REVISION").map(mapEntry),
          }
        : null,
    }
  })

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">الرسائل</h1>
        <p className="text-sm text-muted-foreground">رسائل أولياء الأمور عبر واتساب</p>
      </div>
      <MessagesClient
        categories={categories}
        students={students}
        classes={classes}
        userName={userName}
      />
    </div>
  )
}

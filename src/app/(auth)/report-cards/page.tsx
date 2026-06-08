import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ReportCardsClient } from "./report-cards-client"

export default async function ReportCardsPage() {
  const session = await auth()
  const role = session!.user.role!
  const userId = session!.user.id!

  const classes =
    role === "PRINCIPAL"
      ? await prisma.class.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, name: true, teacher: { select: { fullName: true } } },
        })
      : await prisma.class.findMany({
          where: { teacherId: userId, status: "ACTIVE" },
          select: { id: true, name: true, teacher: { select: { fullName: true } } },
        })

  const classIds = classes.map((c) => c.id)
  const classMap = new Map(
    classes.map((c) => [c.id, { name: c.name, teacherName: c.teacher.fullName }]),
  )

  const rawStudents = await prisma.student.findMany({
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
    },
    orderBy: { fullName: "asc" },
  })

  const students = rawStudents.map((s) => ({
    id: s.id,
    fullName: s.fullName,
    guardianPhone: s.guardianPhone,
    guardianName: s.guardianName,
    className: s.classId ? (classMap.get(s.classId)?.name ?? null) : null,
    teacherName: s.classId ? (classMap.get(s.classId)?.teacherName ?? null) : null,
    totalPages: s.currentTotalPagesMemorized,
  }))

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">كشف الدرجات</h1>
        <p className="text-sm text-muted-foreground">
          اختر طالباً وفترة زمنية لتوليد كشف المتابعة
        </p>
      </div>
      <ReportCardsClient students={students} />
    </div>
  )
}

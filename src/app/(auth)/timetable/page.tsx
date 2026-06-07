import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { TimetableClient } from "./timetable-client"

export default async function TimetablePage() {
  const session = await auth()
  const role   = session!.user.role!
  const userId = session!.user.id!

  const whereClause =
    role === "TEACHER"
      ? { teacherId: userId, status: "ACTIVE" as const }
      : { status: "ACTIVE" as const }

  const classes = await prisma.class.findMany({
    where: whereClause,
    include: {
      teacher:       { select: { id: true, fullName: true } },
      scheduleSlots: { orderBy: { startTime: "asc" } },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">الجدول الأسبوعي</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {role === "PRINCIPAL" ? "جميع الحلقات النشطة" : "حلقاتي"}
        </p>
      </div>
      <TimetableClient classes={classes} role={role} />
    </div>
  )
}

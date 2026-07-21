import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ClassesClient } from "./classes-client"

export default async function ClassesPage() {
  const session = await auth()
  const role    = session!.user.role!
  const userId  = session!.user.id!

  const where = role === "PRINCIPAL" ? {} : { teacherId: userId }

  const [classes, teachers] = await Promise.all([
    prisma.class.findMany({
      where,
      select: {
        id: true, name: true, level: true, location: true, capacity: true, sponsorship: true, fundingBody: true, status: true,
        teacher: { select: { id: true, fullName: true, kunya: true } },
        _count:  { select: { students: { where: { status: { in: ["ACTIVE" as const, "GUEST" as const] } } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    role === "PRINCIPAL"
      ? prisma.user.findMany({ where: { role: "TEACHER", isActive: true }, select: { id: true, fullName: true, kunya: true } })
      : Promise.resolve([]),
  ])

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">الحلقات</h1>
        <p className="text-muted-foreground mt-1">
          {role === "PRINCIPAL" ? "إدارة جميع الحلقات" : "حلقاتي"}
        </p>
      </div>
      <ClassesClient classes={classes} teachers={teachers} isPrincipal={role === "PRINCIPAL"} />
    </div>
  )
}

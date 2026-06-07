import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { StudentsList } from "./students-list"

export default async function StudentsPage() {
  const session = await auth()
  const role    = session!.user.role!
  const userId  = session!.user.id!

  const where =
    role === "PRINCIPAL"
      ? {}
      : { class: { teacherId: userId }, status: { in: ["ACTIVE" as const, "GUEST" as const] } }

  const studentsRaw = await prisma.student.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
    },
    orderBy: { fullName: "asc" },
  })
  const students = studentsRaw

  const classes =
    role === "PRINCIPAL"
      ? await prisma.class.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : await prisma.class.findMany({ where: { teacherId: userId, status: "ACTIVE" }, select: { id: true, name: true } })

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">الطلاب</h1>
        <p className="text-muted-foreground mt-1">
          {role === "PRINCIPAL" ? "جميع الطلاب" : "طلاب حلقاتي"}
        </p>
      </div>
      <StudentsList students={students} classes={classes} isPrincipal={role === "PRINCIPAL"} />
    </div>
  )
}

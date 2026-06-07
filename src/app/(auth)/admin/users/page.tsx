import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { TeacherTable } from "./teacher-table"

export default async function AdminUsersPage() {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") redirect("/dashboard")

  const teachers = await prisma.user.findMany({
    where:   { role: "TEACHER" },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { classes: true } } },
  })

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المعلمون</h1>
          <p className="text-muted-foreground mt-1">إدارة حسابات المعلمين</p>
        </div>
      </div>
      <TeacherTable teachers={teachers} />
    </div>
  )
}

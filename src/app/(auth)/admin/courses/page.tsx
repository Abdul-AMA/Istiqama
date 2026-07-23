import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { CoursesClient } from "./courses-client"

export default async function AdminCoursesPage() {
  const session = await auth()
  if (session!.user.role !== "PRINCIPAL") redirect("/dashboard")

  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      badges: { select: { id: true, name: true }, orderBy: { sortOrder: "asc" } },
    },
  })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">الدورات</h1>
        <p className="text-sm text-muted-foreground">
          إدارة الدورات والشارات — تظهر الدورات النشطة في تبويب «الدورات» لدى كل معلم
        </p>
      </div>
      <CoursesClient courses={courses} />
    </div>
  )
}

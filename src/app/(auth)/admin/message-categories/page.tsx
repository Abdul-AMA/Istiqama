import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { CategoriesClient } from "./categories-client"

export default async function MessageCategoriesPage() {
  const session = await auth()
  if (session!.user.role !== "PRINCIPAL") redirect("/dashboard")

  const categories = await prisma.messageCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, tone: true, template: true, sortOrder: true, isActive: true },
  })

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold">فئات رسائل أولياء الأمور</h1>
        <p className="text-sm text-muted-foreground">إدارة قوالب الرسائل المرسلة لأولياء الأمور</p>
      </div>
      <CategoriesClient categories={categories} />
    </div>
  )
}

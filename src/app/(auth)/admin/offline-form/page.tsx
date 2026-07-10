import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { AdminOfflineFormClient } from "./admin-offline-form-client"

export default async function AdminOfflineFormPage() {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") redirect("/dashboard")

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER", isActive: true },
    select: {
      id: true,
      fullName: true,
      classes: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          students: {
            where: { status: { in: ["ACTIVE", "GUEST"] } },
            select: { id: true, fullName: true },
            orderBy: { fullName: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { fullName: "asc" },
  })

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? ""

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">نموذج الحصة غير المتصل — إدارة</h1>
        <p className="text-muted-foreground mt-1">
          اختر معلماً وحلقة لتنزيل نموذج مخصص لهما
        </p>
      </div>

      {!botUsername && (
        <p className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          لم يتم إعداد اسم بوت تيليجرام (TELEGRAM_BOT_USERNAME) بعد.
        </p>
      )}

      <AdminOfflineFormClient
        botUsername={botUsername}
        teachers={teachers.map((t) => ({
          id: t.id,
          fullName: t.fullName,
          classes: t.classes.map((c) => ({ id: c.id, name: c.name, roster: c.students })),
        }))}
      />
    </div>
  )
}

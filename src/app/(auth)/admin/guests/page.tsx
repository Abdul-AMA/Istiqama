import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { GuestsClient } from "./guests-client"

export default async function AdminGuestsPage() {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") redirect("/dashboard")

  const [guests, classes] = await Promise.all([
    prisma.student.findMany({
      where:  { status: "GUEST" as const },
      select: {
        id: true, fullName: true, gender: true, guardianPhone: true, notes: true, createdAt: true,
        class: { select: { id: true, name: true, teacher: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.class.findMany({
      where:   { status: "ACTIVE" },
      select:  { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">الطلاب الضيوف</h1>
        <p className="text-muted-foreground mt-1">
          {guests.length === 0
            ? "لا يوجد طلاب ضيوف في الانتظار"
            : `${guests.length} ضيف ينتظر تحويله لطالب نظامي`}
        </p>
      </div>
      <GuestsClient guests={guests} classes={classes} />
    </div>
  )
}

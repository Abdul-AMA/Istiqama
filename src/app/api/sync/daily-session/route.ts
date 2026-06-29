import { type NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sessionInputSchema, saveDailySessionCore } from "@/lib/daily-session/save"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "غير مصرح" }, { status: 401 })

  const body = await req.json()
  const parsed = sessionInputSchema.safeParse(body.payload)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { classId, date: dateStr, entries } = parsed.data
  const userId = session.user.id!
  const role = session.user.role!

  if (role !== "PRINCIPAL") {
    const cls = await prisma.class.findFirst({ where: { id: classId, teacherId: userId } })
    if (!cls) return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  try {
    await saveDailySessionCore({ classId, date: new Date(dateStr), entries, userId })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("sync daily-session error:", err)
    return NextResponse.json({ error: "حدث خطأ أثناء الحفظ" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (session?.user?.role !== "PRINCIPAL") {
    return NextResponse.json({ error: "غير مصرح" }, { status: 403 })
  }

  const [
    students,
    classes,
    teachers,
    scheduleSlots,
    attendanceRecords,
    hifzSessions,
    sardRecords,
    messageLogs,
    messageCategories,
  ] = await Promise.all([
    prisma.student.findMany({ orderBy: { fullName: "asc" } }),
    prisma.class.findMany({
      include: { teacher: { select: { id: true, fullName: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: "TEACHER" },
      select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true, role: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.scheduleSlot.findMany({ orderBy: { dayOfWeek: "asc" } }),
    prisma.attendanceRecord.findMany({ orderBy: { date: "desc" } }),
    prisma.hifzSession.findMany({
      include: { entries: true },
      orderBy: { date: "desc" },
    }),
    prisma.sardRecord.findMany({ orderBy: { date: "desc" } }),
    prisma.messageLog.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.messageCategory.findMany({ orderBy: { sortOrder: "asc" } }),
  ])

  const payload = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.name,
    version: "1",
    data: {
      students,
      classes,
      teachers,
      scheduleSlots,
      attendanceRecords,
      hifzSessions,
      sardRecords,
      messageLogs,
      messageCategories,
    },
  }

  const json = JSON.stringify(payload, null, 2)
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="istiqama-backup-${date}.json"`,
    },
  })
}

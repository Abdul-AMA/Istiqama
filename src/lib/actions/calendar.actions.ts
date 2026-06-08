"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"

// ─── DayOfWeek → JS getDay() ──────────────────────────────────────────────────

const DOW_TO_JS: Record<string, number> = {
  SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function getSessionOrThrow() {
  const session = await auth()
  if (!session?.user) throw new Error("غير مصرح")
  return session
}

// ─── Data types ───────────────────────────────────────────────────────────────

export type DayInfo = {
  day: number
  date: string // YYYY-MM-DD
  isToday: boolean
  isClassDay: boolean
  isFuture: boolean
  recordedCount: number
  rosterCount: number
  // status drives the cell colour
  status: "NO_CLASS" | "COMPLETE" | "PARTIAL" | "MISSED" | "UPCOMING" | "EMPTY"
}

export type CalendarClass = {
  id: string
  name: string
  teacher?: { fullName: string }
}

export type CalendarTeacher = {
  id: string
  fullName: string
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getCalendarClasses(teacherId?: string): Promise<CalendarClass[]> {
  const session = await getSessionOrThrow()
  const role = session.user.role!
  const userId = session.user.id!

  if (role === "TEACHER") {
    return prisma.class.findMany({
      where: { teacherId: userId, status: "ACTIVE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })
  }

  return prisma.class.findMany({
    where: { status: "ACTIVE", ...(teacherId ? { teacherId } : {}) },
    select: { id: true, name: true, teacher: { select: { fullName: true } } },
    orderBy: { name: "asc" },
  })
}

export async function getTeachersForPrincipal(): Promise<CalendarTeacher[]> {
  const session = await getSessionOrThrow()
  if (session.user.role !== "PRINCIPAL") return []
  return prisma.user.findMany({
    where: { role: "TEACHER", isActive: true },
    select: { id: true, fullName: true },
    orderBy: { fullName: "asc" },
  })
}

export async function getCalendarDayStates(
  classId: string,
  year: number,
  month: number,
): Promise<DayInfo[]> {
  const session = await getSessionOrThrow()
  const role = session.user.role!
  const userId = session.user.id!

  if (role === "TEACHER") {
    const cls = await prisma.class.findFirst({ where: { id: classId, teacherId: userId } })
    if (!cls) throw new Error("غير مصرح")
  }

  // Date range for the month (UTC midnight)
  const firstDay = new Date(Date.UTC(year, month - 1, 1))
  const lastDay = new Date(Date.UTC(year, month, 0))

  // Today as a YYYY-MM-DD string (local time)
  const now = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`

  const [scheduleSlots, students, attendanceRecords] = await Promise.all([
    prisma.scheduleSlot.findMany({ where: { classId }, select: { dayOfWeek: true } }),
    prisma.student.findMany({
      where: { classId, status: { in: ["ACTIVE", "GUEST"] } },
      select: { id: true },
    }),
    prisma.attendanceRecord.findMany({
      where: { classId, date: { gte: firstDay, lte: lastDay } },
      select: { studentId: true, date: true },
    }),
  ])

  const classDaysOfWeek = new Set(scheduleSlots.map((s) => DOW_TO_JS[s.dayOfWeek]))
  const rosterCount = students.length

  // Group attendance records by date string
  const recordsByDate = new Map<string, Set<string>>()
  for (const rec of attendanceRecords) {
    const d = rec.date
    const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`
    if (!recordsByDate.has(dateStr)) recordsByDate.set(dateStr, new Set())
    recordsByDate.get(dateStr)!.add(rec.studentId)
  }

  const daysInMonth = lastDay.getUTCDate()
  const days: DayInfo[] = []

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    const jsDay = new Date(Date.UTC(year, month - 1, d)).getUTCDay()
    const isClassDay = classDaysOfWeek.has(jsDay)
    const isToday = dateStr === todayStr
    const isFuture = dateStr > todayStr

    const records = recordsByDate.get(dateStr)
    const recordedCount = records?.size ?? 0

    let status: DayInfo["status"]
    if (!isClassDay) {
      status = "NO_CLASS"
    } else if (isFuture) {
      status = "UPCOMING"
    } else if (recordedCount === 0) {
      status = isToday ? "EMPTY" : "MISSED"
    } else if (rosterCount > 0 && recordedCount >= rosterCount) {
      status = "COMPLETE"
    } else {
      status = "PARTIAL"
    }

    days.push({ day: d, date: dateStr, isToday, isClassDay, isFuture, recordedCount, rosterCount, status })
  }

  return days
}

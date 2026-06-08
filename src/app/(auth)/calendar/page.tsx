import { auth } from "@/auth"
import { getTeachersForPrincipal, getCalendarClasses } from "@/lib/actions/calendar.actions"
import { CalendarClient } from "./calendar-client"

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; month?: string; teacherId?: string }>
}) {
  const { classId, month, teacherId } = await searchParams
  const session = await auth()
  const role = session!.user.role!

  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [teachers, classes] = await Promise.all([
    role === "PRINCIPAL" ? getTeachersForPrincipal() : Promise.resolve([]),
    getCalendarClasses(teacherId),
  ])

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold">التقويم</h1>
      <CalendarClient
        role={role}
        teachers={teachers}
        initialClasses={classes}
        initialClassId={classId ?? ""}
        initialMonth={month ?? defaultMonth}
        initialTeacherId={teacherId ?? ""}
      />
    </div>
  )
}

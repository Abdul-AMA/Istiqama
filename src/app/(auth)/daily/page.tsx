import { getMyClasses } from "@/lib/actions/daily-session.actions"
import { DailySessionClient } from "./daily-session-client"

export default async function DailyPage({
  searchParams,
}: {
  searchParams: Promise<{ classId?: string; date?: string }>
}) {
  const { classId, date } = await searchParams
  const classes = await getMyClasses()

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">الجلسة اليومية</h1>
        <p className="text-muted-foreground text-sm mt-1">تسجيل الحضور والحفظ لحلقة كاملة</p>
      </div>
      <DailySessionClient
        classes={classes}
        initialClassId={classId ?? ""}
        initialDate={date ?? today}
      />
    </div>
  )
}

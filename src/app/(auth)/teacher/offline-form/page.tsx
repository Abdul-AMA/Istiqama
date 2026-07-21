import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getAllSurahs } from "@/lib/actions/daily-session.actions"
import { OfflineFormClient } from "./offline-form-client"

export default async function TeacherOfflineFormPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const [teacher, classes, surahs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id! },
      select: { kunya: true },
    }),
    prisma.class.findMany({
      where: { teacherId: session.user.id!, status: "ACTIVE" },
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
    }),
    getAllSurahs(),
  ])

  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? ""

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">نموذج الحصة غير المتصل</h1>
        <p className="text-muted-foreground mt-1">
          نزّل نموذجاً لحلقتك لتعبئة الحضور والتسميع بدون اتصال بالإنترنت، ثم أرسله عبر تيليجرام
        </p>
      </div>

      {!botUsername && (
        <p className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          لم يتم إعداد اسم بوت تيليجرام (TELEGRAM_BOT_USERNAME) بعد — يرجى التواصل مع الإدارة قبل استخدام هذه الصفحة.
        </p>
      )}

      <OfflineFormClient
        teacherId={session.user.id!}
        teacherName={session.user.name!}
        teacherKunya={teacher?.kunya ?? null}
        botUsername={botUsername}
        surahs={surahs}
        classes={classes.map((c) => ({
          id: c.id,
          name: c.name,
          roster: c.students,
        }))}
      />
    </div>
  )
}

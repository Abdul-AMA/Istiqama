import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import { ArrowRight, BookOpen, CalendarDays, Phone, Mail, ClipboardList } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type Props = { params: Promise<{ id: string }> }

export default async function TeacherProfilePage({ params }: Props) {
  const { id } = await params
  const session = await auth()
  if (session!.user.role !== "PRINCIPAL") redirect("/dashboard")

  const teacher = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phone: true,
      isActive: true,
      createdAt: true,
      classes: {
        where: { status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          level: true,
          location: true,
          _count: { select: { students: { where: { status: { in: ["ACTIVE", "GUEST"] } } } } },
        },
        orderBy: { name: "asc" },
      },
    },
  })

  if (!teacher) notFound()

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowRight className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{teacher.fullName}</h1>
            <Badge variant={teacher.isActive ? "default" : "secondary"}>
              {teacher.isActive ? "نشط" : "معطل"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">ملف المعلم</p>
        </div>
      </div>

      {/* Contact info */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
          بيانات التواصل
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
          <span dir="ltr">{teacher.email}</span>
        </div>
        {teacher.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span dir="ltr">{teacher.phone}</span>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          انضم في {new Date(teacher.createdAt).toLocaleDateString("ar-SA")}
        </p>
      </div>

      {/* Classes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            الحلقات ({teacher.classes.length})
          </h2>
          <Link href={`/calendar?teacherId=${teacher.id}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              تقويم المعلم
            </Button>
          </Link>
        </div>

        {teacher.classes.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">
            لا توجد حلقات نشطة لهذا المعلم
          </div>
        ) : (
          <div className="space-y-3">
            {teacher.classes.map((cls) => (
              <div key={cls.id} className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h3 className="font-semibold">{cls.name}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cls._count.students} طالب
                      {cls.level && ` · ${cls.level}`}
                      {cls.location && ` · ${cls.location}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Link href={`/calendar?classId=${cls.id}&teacherId=${teacher.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 h-9">
                      <CalendarDays className="h-3.5 w-3.5" />
                      التقويم
                    </Button>
                  </Link>
                  <Link href={`/daily?classId=${cls.id}`}>
                    <Button variant="outline" size="sm" className="gap-1.5 h-9">
                      <ClipboardList className="h-3.5 w-3.5" />
                      الجلسة اليومية
                    </Button>
                  </Link>
                  <Link href={`/classes/${cls.id}`}>
                    <Button variant="ghost" size="sm" className="h-9">
                      قائمة الطلاب
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
